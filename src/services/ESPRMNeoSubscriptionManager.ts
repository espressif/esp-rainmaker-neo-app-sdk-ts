/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ESPNodeUpdateData,
  ESPSubscriptionChannelInterface,
  NodeLike,
  resolveNodeId,
} from "../types/subscription";
import { NodeMQTTOrchestrator } from "./NodeMQTTOrchestrator";
import { Logger } from "../utils/logger";

const logger = new Logger("ESPRMNeoSubscriptionManager");

/**
 * Manages subscription channels and coordinates node update subscriptions.
 * This is the central hub for all parameter update subscriptions from various sources
 * (custom channels)
 *
 * The manager uses a priority-based approach:
 * 1. For each node, it determines the effective channel order (node-specific or global)
 * 2. It filters channels based on availability and node support
 * 3. It tries channels in order until one succeeds
 *
 * Subscription pattern: register one or more channels, set global channel order,
 * then subscribeToNode(node, callback). Node must have .id; for channel selection it may
 * have .type, .metadata, .subscriptionConfig.channelOrder. Callback receives ESPNodeUpdateData.
 *
 * @example
 * ```typescript
 * // Register channels
 * await ESPRMNeoBase.subscriptionManager.registerChannel(new MQTTSubscriptionChannel());
 *
 * // Set global channel order (applies to nodes without their own override)
 * ESPRMNeoBase.subscriptionManager.setGlobalChannelOrder(["mqtt"]);
 *
 * // Subscribe to node updates (node can be an SDK node or a proxy with { id, nodeId, type, config, metadata })
 * await ESPRMNeoBase.subscriptionManager.subscribeToNode(node, (update) => {
 *   console.log(`Node ${update.nodeId} updated via ${update.source}`);
 * });
 * ```
 */
export class ESPRMNeoSubscriptionManager {
  /**
   * Registered subscription channels (channelId -> channel instance)
   */
  private channels: Map<string, ESPSubscriptionChannelInterface> = new Map();

  /**
   * Global default channel order (used when node doesn't have custom order)
   * Channels are tried in this order until one succeeds
   */
  private globalChannelOrder: string[] = [];

  /**
   * Whether the manager has been initialized
   */
  private initialized: boolean = false;

  /**
   * Initialize the subscription manager.
   * This initializes all registered channels.
   * Should be called during SDK initialization.
   *
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    for (const channel of this.channels.values()) {
      try {
        await channel.initialize();
      } catch (error) {
        logger.error(
          `Failed to initialize channel ${channel.channelId}:`,
          error
        );
      }
    }

    this.initialized = true;
  }

  /**
   * Register a new subscription channel.
   *
   * @param channel - The channel to register
   * @param autoInitialize - Whether to initialize the channel immediately (default: true)
   * @throws Error if a channel with the same ID is already registered
   *
   * @example
   * ```typescript
   * const mqttChannel = new MQTTSubscriptionChannel();
   * await ESPRMNeoBase.subscriptionManager.registerChannel(mqttChannel);
   * ```
   */
  async registerChannel(
    channel: ESPSubscriptionChannelInterface,
    autoInitialize: boolean = true
  ): Promise<void> {
    if (this.channels.has(channel.channelId)) {
      throw new Error(`Channel ${channel.channelId} is already registered`);
    }

    this.channels.set(channel.channelId, channel);

    if (autoInitialize && this.initialized) {
      await channel.initialize();
    }
  }

  /**
   * Unregister a subscription channel.
   * This will dispose the channel and remove it from the manager.
   *
   * @param channelId - ID of the channel to unregister
   *
   * @example
   * ```typescript
   * await ESPRMNeoBase.subscriptionManager.unregisterChannel("mqtt");
   * ```
   */
  async unregisterChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    await channel.dispose();
    this.channels.delete(channelId);
  }

  /**
   * Set the global default channel order.
   * This order is used for all nodes unless they have a custom order in subscriptionConfig.
   *
   * @param channelIds - Array of channel IDs in priority order (first = highest priority)
   *
   * @example
   * ```typescript
   * // Try Matter first, then MQTT
   * ESPRMNeoBase.subscriptionManager.setGlobalChannelOrder([
   *   "matter",
   *   "mqtt"
   * ]);
   * ```
   */
  setGlobalChannelOrder(channelIds: string[]): void {
    const invalidChannels = channelIds.filter((id) => !this.channels.has(id));
    if (invalidChannels.length > 0) {
      logger.warn(`Unknown channels in order: ${invalidChannels.join(", ")}`);
    }

    this.globalChannelOrder = channelIds;
  }

  /**
   * Get the effective channel order for a node.
   * Priority: node.subscriptionConfig.channelOrder > global channel order
   *
   * @param node - The node to get channel order for
   * @returns Array of channel IDs in priority order
   */
  getEffectiveChannelOrder(node: NodeLike): string[] {
    // Use the per-node override only when it is non-empty. An empty array is
    // treated the same as "not set" so a stray/rehydrated `channelOrder: []`
    // falls back to the global order instead of trapping the node with no
    // available channels (which only clearSubscriptionChannelOrder() could undo).
    if (node.subscriptionConfig?.channelOrder?.length) {
      return node.subscriptionConfig.channelOrder;
    }

    return this.globalChannelOrder;
  }

  /**
   * Get available channels for a node.
   * Filters channels based on:
   * - Channel is registered
   * - Channel supports the node (via supportsNode())
   * - Channel is in the effective order
   *
   * @param node - The node to get channels for
   * @returns Array of available channels in priority order
   *
   * @example
   * ```typescript
   * const channels = ESPRMNeoBase.subscriptionManager.getAvailableChannelsForNode(node);
   * console.log(`Available channels: ${channels.map(c => c.channelId).join(", ")}`);
   * ```
   */
  getAvailableChannelsForNode(node: NodeLike): ESPSubscriptionChannelInterface[] {
    const effectiveOrder = this.getEffectiveChannelOrder(node);

    return effectiveOrder
      .map((channelId) => this.channels.get(channelId))
      .filter(
        (channel) => channel && channel.supportsNode(node)
      ) as ESPSubscriptionChannelInterface[];
  }

  /**
   * Builds a diagnostic message for the "no available channels" case. Lists the
   * effective order, the registered channels, and which ids in the order are
   * unregistered vs. registered-but-unsupported — so an order typo or a missing
   * channel is easy to spot. Used in place of set-time validation, which would
   * false-positive when an order references a not-yet-registered channel
   * (e.g. an order set before its target channel registers).
   *
   * @param node - The node being subscribed.
   * @param nodeId - The resolved node id (for the message).
   * @returns A human-readable diagnostic error message.
   */
  private buildNoChannelsError(node: NodeLike, nodeId: string): string {
    const effectiveOrder = this.getEffectiveChannelOrder(node);
    const registered = this.getRegisteredChannels();
    const unregistered = effectiveOrder.filter((id) => !this.channels.has(id));
    const unsupported = effectiveOrder.filter((id) => {
      const channel = this.channels.get(id);
      return channel ? !channel.supportsNode(node) : false;
    });

    let message =
      `No available subscription channels for node ${nodeId}. ` +
      `Effective order: [${effectiveOrder.join(", ") || "(empty)"}]. ` +
      `Registered channels: [${registered.join(", ") || "(none)"}].`;
    if (unregistered.length) {
      message += ` Unregistered ids in order: [${unregistered.join(", ")}].`;
    }
    if (unsupported.length) {
      message += ` Registered but unsupported for this node: [${unsupported.join(
        ", "
      )}].`;
    }
    return message;
  }

  /**
   * Subscribe to updates for a specific node using priority-based channel selection.
   * Tries channels in order until one succeeds.
   *
   * @param node - The node to subscribe to
   * @param callback - Function to call when updates are received
   * @throws Error if no channels are available or all channels fail
   *
   * @example
   * ```typescript
   * await ESPRMNeoBase.subscriptionManager.subscribeToNode(node, (update) => {
   *   console.log(`Update from ${update.source}:`, update.payload);
   * });
   * ```
   */
  async subscribeToNode(
    node: NodeLike,
    callback: (update: ESPNodeUpdateData) => void
  ): Promise<void> {
    const nodeId = resolveNodeId(node);
    if (!nodeId) {
      throw new Error("Cannot subscribe: node has no id or nodeId");
    }

    const availableChannels = this.getAvailableChannelsForNode(node);

    if (availableChannels.length === 0) {
      throw new Error(this.buildNoChannelsError(node, nodeId));
    }

    let lastError: Error | undefined;

    for (const channel of availableChannels) {
      try {
        await channel.subscribe(callback, node);
        return;
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw new Error(
      `All subscription channels failed for node ${nodeId}. Last error: ${lastError?.message}`
    );
  }

  /**
   * Subscribe to updates for all nodes.
   *
   * @param nodes - Array of nodes to subscribe to
   * @param callback - Function to call when any node is updated
   *
   * @example
   * ```typescript
   * const nodes = group.getNodes();
   * await ESPRMNeoBase.subscriptionManager.subscribeToAllNodes(nodes, (update) => {
   *   console.log(`Node ${update.nodeId} updated`);
   * });
   * ```
   */
  async subscribeToAllNodes(
    nodes: NodeLike[],
    callback: (update: ESPNodeUpdateData) => void
  ): Promise<void> {
    const errors: Array<{ nodeId: string; error: Error }> = [];

    for (const node of nodes) {
      try {
        await this.subscribeToNode(node, callback);
      } catch (error) {
        errors.push({
          nodeId: resolveNodeId(node) ?? "unknown",
          error: error as Error,
        });
      }
    }

    if (errors.length > 0) {
      logger.warn(`Failed to subscribe to ${errors.length} nodes:`, errors);
    }
  }

  /**
   * Unsubscribe from updates for a specific node across all channels.
   *
   * @param nodeId - ID of the node to unsubscribe from.
   * @param callback - Optional specific subscriber to remove. When provided,
   *   only that callback is detached (the node's other subscribers keep
   *   receiving updates); when omitted, all subscribers for the node are
   *   removed AND the node's MQTT shadow binding on {@link NodeMQTTOrchestrator}
   *   is cleared — so the next subscribe re-registers a fresh shadow name
   *   (needed when app-side membership changes the node's shadow topic).
   *
   * @example
   * ```typescript
   * // Remove one subscriber (siblings keep receiving updates):
   * await ESPRMNeoBase.subscriptionManager.unsubscribeFromNode("node-123", myCallback);
   * // Remove every subscriber for the node + clear MQTT shadow binding:
   * await ESPRMNeoBase.subscriptionManager.unsubscribeFromNode("node-123");
   * ```
   */
  async unsubscribeFromNode(
    nodeId: string,
    callback?: (update: ESPNodeUpdateData) => void
  ): Promise<void> {
    for (const channel of this.channels.values()) {
      try {
        await channel.unsubscribe(nodeId, callback);
      } catch (error) {
        logger.warn(
          `Failed to unsubscribe from ${channel.channelId} for node ${nodeId}:`,
          error
        );
      }
    }

    // Full purge (no specific callback): also drop the orchestrator's
    // nodeId → shadowName binding so a later subscribe re-registers the node
    // against its current shadow. Consumers that just detach one callback
    // keep the binding intact for other subscribers.
    if (!callback) {
      try {
        NodeMQTTOrchestrator.unregisterNode(nodeId);
      } catch (error) {
        logger.warn(
          `Failed to unregister node ${nodeId} from NodeMQTTOrchestrator:`,
          error
        );
      }
    }
  }

  /**
   * Get all registered channel IDs.
   *
   * @returns Array of channel IDs
   *
   * @example
   * ```typescript
   * const channels = ESPRMNeoBase.subscriptionManager.getRegisteredChannels();
   * console.log(`Registered channels: ${channels.join(", ")}`);
   * ```
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Get the global channel order.
   *
   * @returns Array of channel IDs in priority order
   */
  getGlobalChannelOrder(): string[] {
    return [...this.globalChannelOrder];
  }

  /**
   * Cleanup all subscriptions and dispose channels.
   * Should be called when app is closing or SDK is being torn down.
   *
   * @example
   * ```typescript
   * await ESPRMNeoBase.subscriptionManager.dispose();
   * ```
   */
  async dispose(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.dispose();
    }

    this.channels.clear();
    this.initialized = false;
  }
}
