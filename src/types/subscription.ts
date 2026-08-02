/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Standardized format for node parameter updates from any subscription channel.
 * All subscription channels must transform their data into this format.
 */
export interface ESPNodeUpdateData {
  /**
   * ID of the node that was updated
   */
  nodeId: string;

  /**
   * Source channel that provided this update (e.g., "mqtt", "matter", "ble")
   */
  source: string;

  /**
   * Type of event (e.g., "rmneo.event.node_params_changed")
   */
  eventType: string;

  /**
   * The actual parameter data
   * Format: { <deviceId>: { <paramId>: value } }
   */
  payload: Record<string, any>;

  /**
   * Optional metadata specific to the channel
   * Examples:
   * - MQTT: { topic: "...", shadowName: "params-groupId", qos: 1 }
   * - Matter: { endpointId: 1, clusterId: 6, attributeId: 0 }
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for subscription channels that provide device parameter updates.
 * Each channel represents a different communication method (MQTT, Matter, BLE, etc.)
 *
 * Implementation Guidelines:
 * - channelId should be unique and descriptive (e.g., "mqtt", "matter", "ble")
 * - supportsNode() should check if the node has the required capabilities/configuration
 * - subscribe() should set up the subscription and call the callback when updates arrive
 * - All updates must be transformed into ESPNodeUpdateData format
 */
export interface ESPSubscriptionChannelInterface {
  /**
   * Unique identifier for this channel (e.g., "mqtt", "matter", "ble")
   */
  readonly channelId: string;

  /**
   * Initialize the channel (setup connections, adapters, etc.)
   * Called once when channel is registered with the subscription manager
   *
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Check if this channel supports a specific node.
   * This method determines whether the channel can provide updates for the given node.
   *
   * Examples:
   * - MQTT channel: returns true for all nodes (generic)
   * - Matter channel: returns true only if node has Matter capability in its config
   * - BLE channel: returns true only if node has BLE support in metadata
   *
   * @param node - The node to check support for
   * @returns true if this channel can provide updates for the node
   */
  supportsNode(node: NodeLike): boolean;

  /**
   * Subscribe to parameter updates for a specific node.
   *
   * @param callback - Function to call when updates are received
   * @param node - The node to subscribe to. Must carry the identifier and any
   *   routing context the channel needs (e.g. `groupId`, `subgroupIds` for MQTT
   *   shadow topic construction). Passing the full node — not just an id —
   *   lets channels operate without reverse-looking up group membership from
   *   persistent state.
   * @returns Promise that resolves when subscription is active
   * @throws Error if subscription fails (e.g., adapter not configured, connection failed)
   */
  subscribe(
    callback: (update: ESPNodeUpdateData) => void,
    node: NodeLike
  ): Promise<void>;

  /**
   * Unsubscribe from updates.
   *
   * @param nodeId - Optional node ID. If omitted, unsubscribes every node.
   * @param callback - Optional specific subscriber to remove. When provided,
   *   only that callback is detached; the channel keeps delivering to the node's
   *   other subscribers and fully detaches the node only once none remain. When
   *   omitted, all subscribers for the node are removed.
   * @returns Promise that resolves when unsubscription is complete
   */
  unsubscribe(
    nodeId?: string,
    callback?: (update: ESPNodeUpdateData) => void
  ): Promise<void>;

  /**
   * Cleanup and dispose of all channel resources (connections, callbacks, etc.).
   * Called when the channel is unregistered or the app is closing.
   */
  dispose(): Promise<void>;
}

/**
 * Subscription configuration for a specific node.
 * Allows per-node customization of subscription channel priority.
 */
export interface ESPNodeSubscriptionConfig {
  /**
   * Custom channel order for this node (overrides global order).
   * Channels are tried in the order specified until one succeeds.
   * If not set, uses the global channel order from ESPRMNeoSubscriptionManager.
   *
   * Example: ["matter", "mqtt"]
   * - Try Matter first (if supported)
   * - Fall back to MQTT
   */
  channelOrder?: string[];
}

/**
 * Minimal structural shape the subscription manager needs from a node.
 *
 * Used instead of a hard dependency on {@link ESPRMNeoNode} so that satellite
 * SDKs (Matter, BLE, …) and lightweight proxies can be passed to the manager.
 * A node is identified by {@link id} or {@link nodeId}; channel selection may
 * also read {@link subscriptionConfig}, {@link type} and {@link metadata}.
 */
export interface NodeLike {
  /** Node identifier (preferred). */
  id?: string;
  /** Node identifier as used by {@link ESPRMNeoNode}. */
  nodeId?: string;
  /**
   * Group this node belongs to. Required for channels that route by group
   * (e.g. MQTT constructs its shadow name from `groupId` + `subgroupIds`).
   */
  groupId?: string;
  /**
   * Subgroup ids this node belongs to under {@link groupId}. Passed through to
   * MQTT shadow-name construction. Empty/omitted → group-level shadow.
   */
  subgroupIds?: string[];
  /** Per-node channel order override. */
  subscriptionConfig?: ESPNodeSubscriptionConfig;
  /** Optional node type hint used by capability-gated channels. */
  type?: string;
  /** Optional metadata used by capability-gated channels (e.g. Matter markers). */
  metadata?: Record<string, unknown>;
}

/**
 * Resolves the canonical node id from a {@link NodeLike} (`id` preferred,
 * falling back to `nodeId`).
 *
 * @param node - The node-like object.
 * @returns The node id, or `undefined` if neither field is set.
 */
export function resolveNodeId(node: NodeLike): string | undefined {
  return node.id ?? node.nodeId;
}
