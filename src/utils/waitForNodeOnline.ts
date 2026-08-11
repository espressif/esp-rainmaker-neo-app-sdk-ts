/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Waits for a RainMakerNeo node to report `online: true` in its AWS IoT Device Shadow.
 *
 * Typical use: after provisioning WiFi credentials, the device joins the network and
 * connects to the cloud. There is no dedicated "online" MQTT topic — connectivity is
 * published as `state.reported.online` inside shadow update messages on the named
 * shadow `params-{groupId}` or `params-{groupId}-{subgroupIds}` (firmware writes this
 * after getGroupInfo; cloud presence only clears online on disconnect).
 *
 * Matches app_sim `_wait_node_online`: subscribe first, then poll shadow GET on an
 * interval until `reported.online === true` (or a live MQTT update arrives). GET may
 * 404 while the shadow does not exist yet — that is expected and ignored.
 *
 * This helper registers a **temporary** subscription via {@link NodeMQTTOrchestrator},
 * resolves when online is detected, then unsubscribes (and unregisters only if it
 * created the binding) so a later {@link ESPRMNeoNode} attach does not lose listeners.
 */

import { ESPRMNeoUser } from "../ESPRMNeoUser";
import { ESPRMNeoMqtt } from "../services/ESPRMNeoMqtt/ESPRMNeoMqtt";
import { NodeMQTTOrchestrator } from "../services/NodeMQTTOrchestrator";
import { ProvErrorCodes } from "./constants";
import { ESPProvError } from "./error/ESPProvError";
import { constructShadowName } from "./shadowUtils";
import { Logger } from "./logger";

const logger = new Logger("waitForNodeOnline");

/** Default max wait after WiFi provisioning before rejecting (2 minutes). */
export const DEFAULT_NODE_ONLINE_TIMEOUT_MS = 120_000;

/** Interval between shadow GET polls while waiting (matches app_sim). */
export const DEFAULT_NODE_ONLINE_POLL_INTERVAL_MS = 5_000;

export interface WaitForNodeOnlineParams {
  nodeId: string;
  /** Group the node was associated with during provisioning (drives shadow name). */
  groupId: string;
  /**
   * Subgroup (room/CG) ids that currently contain the node.
   * Omitted or empty ⇒ home-only shadow `params-{groupId}` (legacy callers).
   * When set, shadow is `params-{groupId}-{sortedSubgroupIds}`.
   */
  subgroupIds?: string[];
  /** Logged-in user; used to connect MQTT if not already connected. */
  user: ESPRMNeoUser;
  timeoutMs?: number;
  /** Shadow GET poll interval. Default: {@link DEFAULT_NODE_ONLINE_POLL_INTERVAL_MS}. */
  pollIntervalMs?: number;
}

/**
 * Creates a promise with externally accessible `resolve` / `reject` handles.
 * Used so MQTT callbacks and the timeout timer can settle the same wait.
 */
function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Schedules a one-shot timeout that rejects the online wait with {@link ESPProvError}.
 * No-ops if the wait already settled (MQTT success, GET poll, or duplicate event).
 */
function createOnlineTimeout(
  nodeId: string,
  timeoutMs: number,
  reject: (reason?: unknown) => void,
  isSettled: () => boolean,
  markSettled: () => void
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    if (isSettled()) {
      return;
    }

    markSettled();

    logger.error("Timed out waiting for node to come online", {
      nodeId,
      timeoutMs,
    });

    reject(new ESPProvError(ProvErrorCodes.NODE_ONLINE_TIMEOUT));
  }, timeoutMs);
}

/**
 * Detects online status from a shadow MQTT payload or getShadow state slice.
 *
 * Live MQTT messages use `{ state: { reported: { online: true } } }`.
 * {@link NodeMQTTOrchestrator.getShadow} returns `{ reported: { online: true } }`.
 */
export function isNodeOnlineFromShadowPayload(payload: unknown): boolean {
  const data = payload as {
    state?: { reported?: { online?: boolean } };
    reported?: { online?: boolean };
  };
  return (
    data?.state?.reported?.online === true || data?.reported?.online === true
  );
}

/**
 * Subscribes to shadow MQTT for `nodeId`, polls getShadow on an interval, resolves
 * when `online: true`, then unsubscribes and unregisters the temporary node binding
 * (if owned).
 *
 * @throws {ESPProvError} If `timeoutMs` elapses without the node reporting online.
 * @throws {Error} If MQTT connection or subscription fails.
 */
export async function waitForNodeOnline({
  nodeId,
  groupId,
  subgroupIds,
  user,
  timeoutMs = DEFAULT_NODE_ONLINE_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_NODE_ONLINE_POLL_INTERVAL_MS,
}: WaitForNodeOnlineParams): Promise<void> {
  const shadowName = constructShadowName(groupId, subgroupIds ?? []);
  logger.info("Waiting for node to come online", {
    nodeId,
    groupId,
    subgroupIds: subgroupIds ?? [],
    shadowName,
    timeoutMs,
    pollIntervalMs,
  });

  // Guards against resolving/rejecting more than once (MQTT vs poll vs timeout race).
  let settled = false;
  const isSettled = () => settled;
  const markSettled = () => {
    settled = true;
  };

  const online = createDeferred<void>();

  const settleOnline = (source: "mqtt" | "shadow_get"): void => {
    if (isSettled()) {
      return;
    }
    markSettled();
    logger.info("Node reported online", { nodeId, source });
    online.resolve();
  };

  /** MQTT shadow callback — resolves the wait when `state.reported.online` becomes true. */
  const onUpdate = (payload: unknown) => {
    if (!isNodeOnlineFromShadowPayload(payload)) {
      return;
    }
    settleOnline("mqtt");
  };

  /** Polls getShadow; ignores missing-shadow errors (expected right after provision). */
  const pollShadowOnce = async (): Promise<void> => {
    if (isSettled()) {
      return;
    }
    try {
      const shadow = await NodeMQTTOrchestrator.getShadow(nodeId);
      if (isNodeOnlineFromShadowPayload(shadow)) {
        settleOnline("shadow_get");
      }
    } catch (error) {
      logger.debug("Shadow get while waiting for online failed; will retry", {
        nodeId,
        error,
      });
    }
  };

  // Avoid wiping a registration owned by ESPRMNeoNode / subscription channel.
  const alreadyRegistered = NodeMQTTOrchestrator.isNodeRegistered(nodeId);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  /** Clears timers, unsubscribes our callback; unregisters only if we created the binding. */
  const cleanup = async (): Promise<void> => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (pollTimer !== undefined) {
      clearInterval(pollTimer);
    }
    try {
      await NodeMQTTOrchestrator.unsubscribeFromNode(nodeId, onUpdate);
      if (!alreadyRegistered) {
        NodeMQTTOrchestrator.unregisterNode(nodeId);
      }
      logger.debug("Cleaned up temporary MQTT subscription", { nodeId });
    } catch (error) {
      logger.warn("Failed to clean up temporary MQTT subscription", {
        nodeId,
        error,
      });
    }
  };

  try {
    // 1. Ensure MQTT connectivity
    const mqttConnected =
      ESPRMNeoMqtt.hasInstance() && (await ESPRMNeoMqtt.getInstance().isConnected());
    if (!mqttConnected) {
      logger.debug("MQTT not connected; connecting before online wait", {
        nodeId,
      });
      await user.connectMQTT();
    }

    // 2. Bind to the membership shadow and subscribe before the shadow may exist.
    // Always registerNode so a leftover longer/stale binding for the same nodeId
    // is rebound to constructShadowName(groupId, subgroupIds).
    NodeMQTTOrchestrator.registerNode(nodeId, shadowName);
    await NodeMQTTOrchestrator.subscribeToNode(nodeId, onUpdate);
    logger.debug("Subscribed to node shadow for online wait", {
      nodeId,
      shadowName,
    });

    // 3. Start timeout only after we are listening
    timer = createOnlineTimeout(
      nodeId,
      timeoutMs,
      online.reject,
      isSettled,
      markSettled
    );

    // 4. Immediate GET + interval poll (app_sim pattern); MQTT updates also settle
    await pollShadowOnce();
    if (!isSettled()) {
      pollTimer = setInterval(() => {
        void pollShadowOnce();
      }, pollIntervalMs);
    }

    // 5. Wait until MQTT update, successful GET, or timeout
    await online.promise;
  } catch (error) {
    markSettled();
    logger.error("Error while waiting for node to come online", error);
    throw error;
  } finally {
    await cleanup();
  }
}
