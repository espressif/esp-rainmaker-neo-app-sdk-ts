/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MQTTTransport } from "./interfaces/MQTTTransport";
import {
  buildGroupControlParamsTopic,
  buildRainMakerUserParamsTopic,
  buildShadowBase,
  buildShadowGroupWildcardTopics,
  buildShadowUpdatePayload,
  extractNodeIdFromTopic,
  getReportedParamsFromShadowDocument,
  getReportedParamsFromShadowLiveMessage,
  getStateFromPayload,
  parseShadowMessage,
} from "../utils/awsShadowTopics";
import {
  cleanupSubscriptionIfIdle,
  clearAllPendingRequests,
  notifyListenersSafely,
  type PendingRequest,
  type ShadowSubscriptionState,
} from "./NodeMQTTOrchestratorHelpers";
import { Logger } from "../utils/logger";

const logger = new Logger("NodeMQTTOrchestrator");

/** Node registration: nodeId → shadowName mapping */
interface NodeRegistration {
  shadowName: string;
}

/** Default timeout (ms) for request-response operations */
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

/**
 * NodeMQTTOrchestrator - Central MQTT orchestration layer for AWS IoT Device Shadow.
 *
 * Design principles:
 * - Node-agnostic: does not depend on the Node class.
 * - Single connection: one MQTT client, one message router.
 * - Deduplicated subscriptions: 30 nodes → maybe 3 shadows → only 3 MQTT subscriptions.
 * - Nodes = dumb consumers, Orchestrator = brain.
 */
export class NodeMQTTOrchestrator {
  // ─── Fields ─────────────────────────────────────────────────────────
  private static _instance: NodeMQTTOrchestrator | null = null;

  /**
   * Increments every time the orchestrator is (re)initialized — e.g. on a
   * logout→login cycle, where {@link clear} wipes all subscription state and a
   * fresh {@link initialize} follows. Subscribers (the MQTT channel) compare
   * this to detect that their cached listener/topic state is stale and must
   * be re-attached to the new orchestrator.
   */
  private static _generation = 0;

  private transport: MQTTTransport | null = null;
  private initialized = false;

  /** nodeId → NodeRegistration */
  private nodeMap = new Map<string, NodeRegistration>();

  /** shadowName → subscription state */
  private shadowSubs = new Map<string, ShadowSubscriptionState>();

  /** responseTopic → pending request (for getShadow, getParams) */
  private pendingRequests = new Map<string, PendingRequest>();

  /**
   * Per-shadow serial op queue. Subscribe / unsubscribe for the same shadow are
   * chained through this so they never interleave across `await` — otherwise
   * two concurrent subscribes for the same shadow could both call
   * `transport.subscribe(...)` and produce duplicate delivery of every message.
   */
  private shadowOps = new Map<string, Promise<unknown>>();

  private constructor() {}

  // ═════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Returns the singleton instance.
   *
   * @throws {Error} If orchestrator is not initialized.
   */
  private static getInstance(): NodeMQTTOrchestrator {
    const instance = NodeMQTTOrchestrator._instance;
    if (!instance || !instance.initialized) {
      throw new Error(
        "NodeMQTTOrchestrator not initialized. Call initialize(transport) first."
      );
    }
    return instance;
  }

  /**
   * Initializes the orchestrator with an MQTT transport. Must be called before
   * any other method.
   *
   * @param transport - MQTT transport for publish/subscribe.
   * @throws {Error} If already initialized. Call {@link clear} first if you
   *   truly need to re-init — a silent swap would leave stale in-memory
   *   subscriptions pointing at topics that were never subscribed on the new
   *   transport.
   */
  static initialize(transport: MQTTTransport): void {
    if (NodeMQTTOrchestrator._instance) {
      throw new Error(
        "NodeMQTTOrchestrator already initialized. Call clear() first if you truly need to re-init."
      );
    }
    NodeMQTTOrchestrator._generation++;
    const instance = new NodeMQTTOrchestrator();
    instance.transport = transport;
    instance.initialized = true;
    NodeMQTTOrchestrator._instance = instance;
  }

  /**
   * Returns the current initialization generation. Increments on each
   * {@link initialize}. Used by subscription channels to detect a
   * logout→login reset and re-attach stale listeners.
   */
  static getGeneration(): number {
    return NodeMQTTOrchestrator._generation;
  }

  /**
   * Clears the singleton and resets it for re-initialization.
   * Rejects all pending requests, unsubscribes shadow wildcard topics and
   * request-response topics, then drops transport and in-memory state.
   */
  static clear(): void {
    const instance = NodeMQTTOrchestrator._instance;
    if (instance) {
      clearAllPendingRequests(
        instance.pendingRequests,
        instance.transport,
        new Error("Orchestrator cleared")
      );

      for (const subscription of instance.shadowSubs.values()) {
        subscription.listeners.clear();
        cleanupSubscriptionIfIdle(subscription, instance.transport);
      }

      instance.transport = null;
      instance.initialized = false;
      instance.nodeMap.clear();
      instance.shadowSubs.clear();
      instance.shadowOps.clear();
    }
    NodeMQTTOrchestrator._instance = null;
  }

  /**
   * Soft-resets session-scoped state without dropping the singleton. Called
   * from {@link ESPRMNeoUser.logout} so the orchestrator is ready for the
   * next login without a public re-initialize step. Rejects pending requests,
   * clears shadow listeners, drops node registrations, and bumps
   * {@link _generation} so subscription channels detect the reset and
   * re-attach on next login. Keeps `transport`, `initialized`, and
   * `_instance` intact so `getInstance()` continues to work.
   */
  static resetSession(): void {
    const instance = NodeMQTTOrchestrator._instance;
    if (!instance) return;

    clearAllPendingRequests(
      instance.pendingRequests,
      instance.transport,
      new Error("Orchestrator session reset")
    );

    for (const subscription of instance.shadowSubs.values()) {
      subscription.listeners.clear();
      cleanupSubscriptionIfIdle(subscription, instance.transport);
    }

    instance.nodeMap.clear();
    instance.shadowSubs.clear();
    instance.shadowOps.clear();

    NodeMQTTOrchestrator._generation++;
  }

  // ═════════════════════════════════════════════════════════════════════
  // Node registration
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Registers a node with the orchestrator.
   * Must be called before subscribeToNode, getParams, getShadow, etc.
   * On shadow rename: clears the old binding; ignores shorter/incomplete names.
   * Shrink membership via {@link unregisterNode} first.
   *
   * @param nodeId - The device/node identifier.
   * @param shadowName - The named shadow (e.g. `params-groupId-subgroupId`).
   */
  static registerNode(nodeId: string, shadowName: string): void {
    const instance = NodeMQTTOrchestrator.getInstance();
    const existing = instance.nodeMap.get(nodeId);

    if (existing && existing.shadowName !== shadowName) {
      if (
        shadowName.split("-").length < existing.shadowName.split("-").length
      ) {
        return;
      }
      NodeMQTTOrchestrator.unregisterNode(nodeId);
    }

    instance.nodeMap.set(nodeId, { shadowName });

    if (!instance.shadowSubs.has(shadowName)) {
      const config = {
        topics: buildShadowGroupWildcardTopics(shadowName),
        listeners: new Map(),
        subscribed: false,
      } as ShadowSubscriptionState;
      instance.shadowSubs.set(shadowName, config);
    }
  }

  /**
   * Unregisters a node. Removes from nodeMap and cleans up listeners.
   * Unsubscribes from shadow topic if no other nodes use it.
   *
   * @param nodeId - The device/node identifier.
   */
  static unregisterNode(nodeId: string): void {
    const instance = NodeMQTTOrchestrator.getInstance();
    const registration = instance.nodeMap.get(nodeId);

    if (!registration) return;

    instance.nodeMap.delete(nodeId);

    const subscription = instance.shadowSubs.get(registration.shadowName);
    if (subscription) {
      subscription.listeners.delete(nodeId);
      cleanupSubscriptionIfIdle(subscription, instance.transport);
    }
  }

  /**
   * Checks if a node is registered. Returns `false` if the orchestrator has
   * not been initialized at all (safe read-only check, matches
   * {@link getRegisteredNodeCount} — the mutating methods throw instead).
   *
   * @param nodeId - The device/node identifier.
   */
  static isNodeRegistered(nodeId: string): boolean {
    const instance = NodeMQTTOrchestrator._instance;
    return instance?.nodeMap.has(nodeId) ?? false;
  }

  /**
   * Number of registered nodes (for debugging). Returns 0 if not initialized.
   */
  static getRegisteredNodeCount(): number {
    const instance = NodeMQTTOrchestrator._instance;
    return instance?.nodeMap.size ?? 0;
  }

  // ═════════════════════════════════════════════════════════════════════
  // Subscription
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Subscribes to node param updates. Deduplicates MQTT subscriptions by
   * shadow.
   *
   * @param nodeId - The device/node identifier.
   * @param callback - Callback invoked when shadow update/accepted is received.
   * @throws {Error} If node is not registered, MQTT is not connected, or the
   *   underlying transport subscribe fails. On failure no listener is added.
   */
  static async subscribeToNode(
    nodeId: string,
    callback: (params: unknown) => void
  ): Promise<void> {
    const instance = NodeMQTTOrchestrator.getInstance();
    const registration = instance.nodeMap.get(nodeId);
    if (!registration) {
      throw new Error(`Node ${nodeId} not registered`);
    }

    return instance.runSerial(registration.shadowName, async () => {
      if (!instance.transport) {
        throw new Error("MQTT not available");
      }
      if (!(await instance.transport.isConnected())) {
        throw new Error("MQTT not connected");
      }

      const subscription = instance.shadowSubs.get(registration.shadowName)!;

      // (O3) Subscribe on the wire FIRST. Only then wire the listener into
      // memory — otherwise a subscribe failure would leave a stranded
      // listener that will never receive a message.
      if (!subscription.subscribed) {
        const handler = (topic: string, message: Buffer) =>
          instance.handleShadowLiveMessage(
            topic,
            message,
            registration.shadowName
          );

        for (const t of subscription.topics) {
          await instance.transport.subscribe(t, handler);
        }
        subscription.handler = handler;
        subscription.subscribed = true;
      }

      if (!subscription.listeners.has(nodeId)) {
        subscription.listeners.set(nodeId, new Set());
      }
      subscription.listeners.get(nodeId)!.add(callback);
    });
  }

  /**
   * Unsubscribes a callback from a node.
   *
   * In-memory listener removal happens even if MQTT is disconnected —
   * otherwise on reconnect the orchestrator would fan messages out to a stale
   * listener (per-disconnect leak). The network topic-unsubscribe inside
   * `cleanupSubscriptionIfIdle` is best-effort and tolerates a missing
   * connection.
   *
   * @param nodeId - The device/node identifier.
   * @param callback - The callback to remove.
   */
  static async unsubscribeFromNode(
    nodeId: string,
    callback: (params: unknown) => void
  ): Promise<void> {
    const instance = NodeMQTTOrchestrator.getInstance();
    const registration = instance.nodeMap.get(nodeId);
    if (!registration) return;

    return instance.runSerial(registration.shadowName, async () => {
      const subscription = instance.shadowSubs.get(registration.shadowName);
      if (!subscription) return;

      const listeners = subscription.listeners.get(nodeId);
      if (!listeners) return;

      listeners.delete(callback);
      if (listeners.size === 0) {
        subscription.listeners.delete(nodeId);
        cleanupSubscriptionIfIdle(subscription, instance.transport);
      }
    });
  }

  /**
   * Routes live shadow messages (update/get accepted/rejected, delta) to
   * listeners. Drops malformed messages at debug level so they're visible in
   * logs during investigation but don't disrupt healthy traffic.
   */
  private handleShadowLiveMessage(
    topic: string,
    message: Buffer,
    shadowName: string
  ): void {
    const subscription = this.shadowSubs.get(shadowName);
    if (!subscription) return;

    // Param listeners only get reported-state traffic on the two canonical
    // channels:
    //   - `/update/documents`: primary real-time channel (API 1.0.0 envelope
    //     with `{ previous, current }`; the util unwraps `current`).
    //   - `/get/accepted`: explicit shadow GET responses.
    //
    // All other subscribed suffixes are intentionally skipped:
    //   - `/update/accepted` duplicates `/update/documents`
    //   - `/update/rejected`, `/get/rejected` are error paths
    //   - `/update/delta` carries desired≠reported diffs, not reported values
    // The full set is subscribed for parity with the firmware topic surface;
    // we just don't fan the non-reported ones out to param listeners.
    if (
      !topic.endsWith("/update/documents") &&
      !topic.endsWith("/get/accepted")
    ) {
      return;
    }

    const nodeId = extractNodeIdFromTopic(topic);
    if (!nodeId) return;

    const listeners = subscription.listeners.get(nodeId);
    if (!listeners || listeners.size === 0) return;

    const parsed = parseShadowMessage(message);
    if (parsed === null) {
      logger.debug("Dropping malformed shadow message", {
        topic,
        byteLength: message.length,
      });
      return;
    }
    const params = getReportedParamsFromShadowLiveMessage(topic, parsed);
    if (Object.keys(params).length === 0) {
      logger.debug("Shadow message has no reported params, ignoring", { topic });
      return;
    }

    notifyListenersSafely(listeners, params);
  }

  /**
   * Runs `op` exclusively per shadow: operations for the same shadowName are
   * chained so they never interleave across an await. Ops for different
   * shadows still run concurrently. Failure of one op does not block later
   * ops (each op sees its own outcome; the queue only tracks completion).
   */
  private runSerial<T>(shadowName: string, op: () => Promise<T>): Promise<T> {
    const prev = this.shadowOps.get(shadowName) ?? Promise.resolve();
    const result = prev.then(op, op);
    const tail = result.then(
      () => undefined,
      () => undefined
    );
    this.shadowOps.set(shadowName, tail);
    void tail.then(() => {
      if (this.shadowOps.get(shadowName) === tail) {
        this.shadowOps.delete(shadowName);
      }
    });
    return result;
  }

  // ═════════════════════════════════════════════════════════════════════
  // Request/response infrastructure
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Request-response helper. Subscribes to accepted + rejected, publishes,
   * resolves on first message.
   *
   * @param publishTopic - Topic to publish the request to.
   * @param acceptedTopic - Successful response topic.
   * @param rejectedTopic - Error response topic.
   * @param payload - Request payload.
   * @param timeoutMs - Timeout in milliseconds.
   * @returns Parsed response or rejects on timeout / invalid response / rejected.
   */
  private static async executeRequestResponse(
    publishTopic: string,
    acceptedTopic: string,
    rejectedTopic: string,
    payload: unknown,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    const instance = NodeMQTTOrchestrator.getInstance();
    const transport = instance.transport;

    if (!transport) {
      throw new Error("Transport not available");
    }
    if (!(await transport.isConnected())) {
      throw new Error("MQTT not connected");
    }

    const topicsToUnsubscribe = [acceptedTopic, rejectedTopic];

    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer);
        instance.pendingRequests.delete(acceptedTopic);
        for (const t of topicsToUnsubscribe) {
          transport.unsubscribe(t, handler).catch(() => {});
        }
      };

      const handler = (topic: string, message: Buffer): void => {
        if (topic === rejectedTopic) {
          cleanup();
          reject(new Error(`Shadow request rejected: ${message.toString()}`));
          return;
        }
        if (topic !== acceptedTopic) {
          return;
        }
        cleanup();
        const parsed = parseShadowMessage(message);
        if (parsed !== null) {
          resolve(parsed);
        } else {
          reject(new Error("Invalid response"));
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Request timeout"));
      }, timeoutMs);

      instance.pendingRequests.set(acceptedTopic, {
        timer,
        handler,
        reject,
        topicsToUnsubscribe,
      });

      Promise.all([
        transport.subscribe(acceptedTopic, handler),
        transport.subscribe(rejectedTopic, handler),
      ])
        .then(() => {
          transport.publish(publishTopic, JSON.stringify(payload ?? {}));
        })
        .catch((err: unknown) => {
          cleanup();
          reject(
            err instanceof Error
              ? err
              : new Error("Failed to subscribe for shadow request")
          );
        });
    });
  }

  /**
   * Fetches the shadow document and extracts a portion via `extractor`.
   *
   * @param nodeId - The device/node identifier.
   * @param extractor - Function to extract desired part from parsed response.
   * @returns The extracted value.
   * @throws {Error} If node is not registered.
   */
  private static async fetchShadowDocument<T>(
    nodeId: string,
    extractor: (parsed: unknown) => T
  ): Promise<T> {
    const instance = NodeMQTTOrchestrator.getInstance();
    const registration = instance.nodeMap.get(nodeId);

    if (!instance.transport) {
      throw new Error("MQTT not connected");
    }
    if (!(await instance.transport.isConnected())) {
      throw new Error("MQTT not connected");
    }
    if (!registration) {
      throw new Error(`Node ${nodeId} not registered`);
    }

    const baseTopic = buildShadowBase(nodeId, registration.shadowName);
    const response = await NodeMQTTOrchestrator.executeRequestResponse(
      `${baseTopic}/get`,
      `${baseTopic}/get/accepted`,
      `${baseTopic}/get/rejected`,
      {},
      DEFAULT_REQUEST_TIMEOUT_MS
    );

    return extractor(response);
  }

  /**
   * Wraps `transport.publish` so publish failures throw with an actionable
   * message. Without this wrapper, callers get whatever the adapter throws
   * (often a generic `TypeError` from a broken pipe) with no topic context.
   */
  private static async publishOrThrow(
    transport: MQTTTransport,
    topic: string,
    payload: string | Buffer
  ): Promise<void> {
    try {
      await transport.publish(topic, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to publish to ${topic}: ${message}`,
        err instanceof Error ? { cause: err } : undefined
      );
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // Public read API
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Gets params (`state.reported.params`) for a node.
   *
   * @param nodeId - The device/node identifier.
   * @returns The reported params map, or `{}` when absent.
   * @throws {Error} If node is not registered.
   */
  static async getParams(nodeId: string): Promise<Record<string, unknown>> {
    return NodeMQTTOrchestrator.fetchShadowDocument(
      nodeId,
      getReportedParamsFromShadowDocument
    );
  }

  /**
   * Gets the full shadow document (`state.reported` + `state.desired`).
   *
   * @param nodeId - The device/node identifier.
   * @returns The full state object.
   * @throws {Error} If node is not registered.
   */
  static async getShadow(nodeId: string): Promise<unknown> {
    return NodeMQTTOrchestrator.fetchShadowDocument(
      nodeId,
      getStateFromPayload
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // Public write API
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Sets params via the RainMaker user params topic (unicast: single node).
   *
   * @param nodeId - The device/node identifier.
   * @param params - Parameter payload (often `{ <deviceId>: { <paramId>: value } }`).
   * @throws {Error} If node is not registered, MQTT is not connected, or the
   *   publish fails.
   */
  static async setParams(nodeId: string, params: unknown): Promise<void> {
    const instance = NodeMQTTOrchestrator.getInstance();
    const registration = instance.nodeMap.get(nodeId);
    if (!instance.transport) {
      throw new Error("Transport not available");
    }
    if (!(await instance.transport.isConnected())) {
      throw new Error("MQTT not connected");
    }
    if (!registration) {
      throw new Error(`Node ${nodeId} not registered`);
    }

    const topic = buildRainMakerUserParamsTopic(nodeId, registration.shadowName);
    const payload =
      typeof params === "string" ? params : JSON.stringify(params ?? {});
    return NodeMQTTOrchestrator.publishOrThrow(instance.transport, topic, payload);
  }

  /**
   * Publishes parameters to the group control MQTT topic (fan-out to all
   * devices in the group or in one subgroup). Does not require a registered
   * node; only a connected MQTT transport (same credentials as unicast
   * `setParams`).
   *
   * @param groupId - Primary group id.
   * @param params - Same payload shape as {@link NodeMQTTOrchestrator.setParams}.
   * @param subgroupId - Omit for group-wide broadcast; set to target one
   *   subgroup.
   */
  static async setGroupParams(
    groupId: string,
    params: unknown,
    subgroupId?: string
  ): Promise<void> {
    const instance = NodeMQTTOrchestrator.getInstance();
    if (!instance.transport) {
      throw new Error("Transport not available");
    }
    if (!(await instance.transport.isConnected())) {
      throw new Error("MQTT not connected");
    }
    if (!groupId) {
      throw new Error("Group ID is required");
    }

    const topic = buildGroupControlParamsTopic(groupId, subgroupId);
    const payload =
      typeof params === "string" ? params : JSON.stringify(params ?? {});
    return NodeMQTTOrchestrator.publishOrThrow(instance.transport, topic, payload);
  }

  /**
   * Updates shadow `state.desired`.
   *
   * @param nodeId - The device/node identifier.
   * @param params - The desired state parameters.
   * @throws {Error} If node is not registered or transport unavailable.
   */
  static async updateShadow(nodeId: string, params: unknown): Promise<void> {
    const instance = NodeMQTTOrchestrator.getInstance();
    const registration = instance.nodeMap.get(nodeId);
    if (!instance.transport) {
      throw new Error("Transport not available");
    }
    if (!(await instance.transport.isConnected())) {
      throw new Error("MQTT not connected");
    }
    if (!registration) {
      throw new Error(`Node ${nodeId} not registered`);
    }

    const topic = `${buildShadowBase(nodeId, registration.shadowName)}/update`;
    const payload = buildShadowUpdatePayload(params);
    return NodeMQTTOrchestrator.publishOrThrow(instance.transport, topic, payload);
  }
}
