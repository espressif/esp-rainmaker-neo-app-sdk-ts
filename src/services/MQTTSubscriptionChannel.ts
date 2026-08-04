/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ESPNodeUpdateData,
  ESPSubscriptionChannelInterface,
  NodeLike,
} from "../types/subscription";
import { NodeMQTTOrchestrator } from "./NodeMQTTOrchestrator";
import { transformShadowToNodeUpdate } from "./ESPRMNeoHelpers/transformShadowToNodeUpdate";
import { constructShadowName } from "../utils/shadowUtils";
import { SubscriptionChannelIds } from "../utils/constants";
import { Logger } from "../utils/logger";

const logger = new Logger("MQTTSubscriptionChannel");

/**
 * MQTT subscription channel for ESP RainMaker Neo.
 *
 * This channel is a thin adapter over {@link NodeMQTTOrchestrator}, which owns
 * the single MQTT connection, the AWS IoT shadow topic subscriptions, and the
 * deduplication of nodes that share a group/subgroup shadow. The channel's job
 * is only to:
 *  - map a node to its shadow and register it with the orchestrator,
 *  - normalize each shadow message into the canonical {@link ESPNodeUpdateData}
 *    envelope (so the app sees the same shape from every channel), and
 *  - fan that envelope out to the app callbacks subscribed for the node.
 *
 * It deliberately does **not** open/close the MQTT connection — that lifecycle
 * is owned by `ESPRMNeoBase.init()` / the orchestrator, so disposing one channel
 * never tears down a connection other channels (or the node) still use.
 *
 * @example
 * ```typescript
 * const mqttChannel = new MQTTSubscriptionChannel();
 * await ESPRMNeoBase.subscriptionManager.registerChannel(mqttChannel);
 * await ESPRMNeoBase.subscriptionManager.subscribeToNode(node, (update) => {
 *   console.log(`Node ${update.nodeId} updated:`, update.payload);
 * });
 * ```
 */
export class MQTTSubscriptionChannel
  implements ESPSubscriptionChannelInterface
{
  readonly channelId = SubscriptionChannelIds.MQTT;

  /**
   * App callbacks per node (nodeId → set of subscriber callbacks).
   */
  private nodeCallbacks: Map<string, Set<(update: ESPNodeUpdateData) => void>> =
    new Map();

  /**
   * The single orchestrator listener installed per node (nodeId → listener).
   * Kept so we can detach exactly that listener on unsubscribe.
   */
  private orchestratorListeners: Map<string, (params: unknown) => void> =
    new Map();

  /**
   * nodeId → orchestrator generation at which we last attached its listener.
   * If the orchestrator is re-initialized (logout→login), the generation
   * changes and we re-attach instead of trusting stale cached state.
   */
  private nodeGeneration: Map<string, number> = new Map();

  /**
   * nodeId → tail of the in-flight operation chain for that node. Subscribe and
   * unsubscribe for the same node are serialized through this so they never
   * interleave across an await boundary (see {@link runSerial}).
   */
  private nodeOps: Map<string, Promise<unknown>> = new Map();

  private isInitialized: boolean = false;

  /**
   * Initialize the channel. The MQTT engine
   * ({@link NodeMQTTOrchestrator} over `ESPRMNeoMqtt`) is initialized by
   * `ESPRMNeoBase.init()` when an `mqttAdapter` is configured, so there is no
   * connection to set up here.
   */
  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  /**
   * MQTT is the universal transport for RainMaker Neo nodes, so this channel
   * supports every node.
   *
   * @param _node - Unused; MQTT supports all Neo nodes.
   * @returns Always `true`.
   */
  supportsNode(_node: NodeLike): boolean {
    return true;
  }

  /**
   * Subscribe to parameter updates for a node.
   *
   * Constructs the node's shadow name from its group/subgroup context, registers
   * it with the orchestrator (deduped by shadow), and installs a single
   * orchestrator listener per node that normalizes shadow messages and fans
   * them out to all subscriber callbacks.
   *
   * @param callback - Invoked with a normalized {@link ESPNodeUpdateData} on each update.
   * @param node - The node to subscribe to. Must carry `nodeId` (or `id`) and
   *   `groupId`; `subgroupIds` optional. Group context is used to build the
   *   shadow name directly — no reverse lookup from persisted state.
   * @throws Error if the node has no id or the orchestrator subscription fails.
   */
  async subscribe(
    callback: (update: ESPNodeUpdateData) => void,
    node: NodeLike
  ): Promise<void> {
    const nodeId = node.nodeId ?? node.id;
    if (!nodeId) {
      throw new Error("MQTTSubscriptionChannel.subscribe requires a node with an id");
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    // Serialize per node so this subscribe never interleaves with another
    // subscribe/detach for the same node across an await. Without this, a late
    // subscriber could attach to about-to-be-rolled-back (failed first install)
    // or about-to-be-torn-down (concurrent detach) state and then silently
    // never receive updates.
    return this.runSerial(nodeId, () =>
      this.installSubscriber(callback, node)
    );
  }

  /**
   * Installs a single subscriber for a node. Runs exclusively per node via
   * {@link runSerial}: the first subscriber constructs the shadow name from the
   * node's group context, registers the node and attaches one shared
   * orchestrator listener; later subscribers join the node's existing callback
   * set.
   *
   * @param callback - Subscriber to add.
   * @param node - The node whose shadow is constructed from its group context.
   */
  private async installSubscriber(
    callback: (update: ESPNodeUpdateData) => void,
    node: NodeLike
  ): Promise<void> {
    const nodeId = (node.nodeId ?? node.id)!;
    const shadowName = constructShadowName(
      node.groupId ?? "",
      node.subgroupIds ?? []
    );

    // Re-bind shadow from node group context (no-op if unchanged).
    NodeMQTTOrchestrator.registerNode(nodeId, shadowName);

    // If the orchestrator was re-initialized since we last attached this node
    // (e.g. logout→login wiped its subscription state), our cached listener is
    // dead. Drop the stale local state so the block below re-creates the
    // listener and re-attaches it to the new orchestrator.
    const generation = NodeMQTTOrchestrator.getGeneration();
    if (
      this.nodeCallbacks.has(nodeId) &&
      this.nodeGeneration.get(nodeId) !== generation
    ) {
      this.nodeCallbacks.delete(nodeId);
      this.orchestratorListeners.delete(nodeId);
    }
    this.nodeGeneration.set(nodeId, generation);

    // First subscriber for this node installs the shared orchestrator listener.
    if (!this.nodeCallbacks.has(nodeId)) {
      const callbacks = new Set<(update: ESPNodeUpdateData) => void>();
      this.nodeCallbacks.set(nodeId, callbacks);

      const listener = (params: unknown): void => {
        const update = transformShadowToNodeUpdate(
          nodeId,
          params,
          { shadowName },
          this.channelId
        );
        callbacks.forEach((cb) => {
          try {
            cb(update);
          } catch (error) {
            logger.error(`Subscriber threw for node ${nodeId}`, error);
          }
        });
      };
      this.orchestratorListeners.set(nodeId, listener);

      try {
        await NodeMQTTOrchestrator.subscribeToNode(nodeId, listener);
      } catch (error) {
        // Roll back bookkeeping so a later retry can subscribe cleanly.
        this.nodeCallbacks.delete(nodeId);
        this.orchestratorListeners.delete(nodeId);
        this.nodeGeneration.delete(nodeId);
        throw error;
      }
    }

    this.nodeCallbacks.get(nodeId)!.add(callback);
  }

  /**
   * Unsubscribe from a node.
   *
   * - No `nodeId`: detach every node.
   * - `nodeId` only: detach the node and all its subscribers.
   * - `nodeId` + `callback`: remove just that subscriber; the node stays
   *   subscribed (and the shared orchestrator listener stays attached) until its
   *   last subscriber is removed, so sibling subscribers are not affected.
   *
   * @param nodeId - Node id to detach; omit to detach all nodes.
   * @param callback - Optional specific subscriber to remove.
   */
  async unsubscribe(
    nodeId?: string,
    callback?: (update: ESPNodeUpdateData) => void
  ): Promise<void> {
    if (!nodeId) {
      const ids = Array.from(this.nodeCallbacks.keys());
      for (const id of ids) {
        await this.runSerial(id, () => this.removeSubscriber(id, undefined));
      }
      return;
    }

    return this.runSerial(nodeId, () =>
      this.removeSubscriber(nodeId, callback)
    );
  }

  /**
   * Removes a subscriber for a node. Runs exclusively per node via
   * {@link runSerial}. With a `callback`, only that subscriber is removed and the
   * node stays subscribed while others remain; once the last subscriber is gone
   * (or when `callback` is omitted) the node is fully detached.
   *
   * @param nodeId - Node id.
   * @param callback - Specific subscriber to remove, or omit to detach the node.
   */
  private async removeSubscriber(
    nodeId: string,
    callback?: (update: ESPNodeUpdateData) => void
  ): Promise<void> {
    if (callback) {
      const callbacks = this.nodeCallbacks.get(nodeId);
      if (!callbacks) return;
      callbacks.delete(callback);
      // Other subscribers remain → keep the node (and its orchestrator listener).
      if (callbacks.size > 0) return;
      // Last subscriber removed → fall through to fully detach the node.
    }

    await this.detachNode(nodeId);
  }

  /**
   * Detach all listeners. The shared MQTT connection is intentionally left
   * intact — its lifecycle is owned by the orchestrator / `ESPRMNeoBase`.
   */
  async dispose(): Promise<void> {
    await this.unsubscribe();
    this.isInitialized = false;
  }

  /**
   * Removes this channel's orchestrator listener for a node and clears its
   * bookkeeping. Only this channel's listener is detached — the orchestrator
   * idle-cleans the underlying shadow topic once no listeners remain, so a
   * node's own subscription (e.g. from `ESPRMNeoNode`) is never clobbered.
   *
   * @param nodeId - Node id to detach.
   */
  private async detachNode(nodeId: string): Promise<void> {
    const listener = this.orchestratorListeners.get(nodeId);
    const callbacks = this.nodeCallbacks.get(nodeId);

    // Drop local state synchronously (before the await) so nothing observes
    // half-torn-down state, and empty the set the listener closes over so an
    // in-flight message during the orchestrator unsubscribe cannot reach a
    // removed subscriber.
    this.orchestratorListeners.delete(nodeId);
    this.nodeCallbacks.delete(nodeId);
    this.nodeGeneration.delete(nodeId);
    callbacks?.clear();

    if (listener) {
      try {
        await NodeMQTTOrchestrator.unsubscribeFromNode(nodeId, listener);
      } catch (error) {
        logger.error(`Failed to unsubscribe node ${nodeId} from MQTT`, error);
      }
    }
  }

  /**
   * Runs `op` exclusively per node: operations for the same nodeId are chained
   * so they never interleave across an await point, while operations for
   * different nodes still run concurrently. The caller receives `op`'s own
   * outcome (success or failure); a failed op does not block later ops.
   *
   * @param nodeId - Node whose operations are serialized.
   * @param op - The operation to run once it reaches the front of the queue.
   * @returns The result of `op`.
   */
  private runSerial<T>(nodeId: string, op: () => Promise<T>): Promise<T> {
    const prev = this.nodeOps.get(nodeId) ?? Promise.resolve();
    // Chain after the previous op regardless of whether it resolved or rejected.
    const result = prev.then(op, op);
    const tail = result.then(
      () => undefined,
      () => undefined
    );
    this.nodeOps.set(nodeId, tail);
    void tail.then(() => {
      // Drop the queue entry once this was the last queued op for the node.
      if (this.nodeOps.get(nodeId) === tail) {
        this.nodeOps.delete(nodeId);
      }
    });
    return result;
  }
}
