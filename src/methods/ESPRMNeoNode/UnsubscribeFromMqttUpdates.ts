/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { NodeMQTTOrchestrator } from "../../services/NodeMQTTOrchestrator";
import { Logger } from "../../utils/logger";

const logger = new Logger("NodeUnsubscribeFromMqttUpdates");

/**
 * Augments the ESPRMNeoNode class with the `unsubscribeFromMqttUpdates` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Stops receiving MQTT shadow updates for this node.
     *
     * Specifically:
     * - Unregisters the node from {@link NodeMQTTOrchestrator}
     * - Removes the node's MQTT shadow listeners
     * - Unsubscribes the shared shadow MQTT topics if no other registered
     *   nodes still use them
     *
     * Call this before dropping the last reference to the node instance so
     * orchestrator registrations and MQTT subscriptions are not left behind.
     * This does not clear local storage, node config cache, or other SDK
     * resources.
     */
    unsubscribeFromMqttUpdates(): void;
  }
}

ESPRMNeoNode.prototype.unsubscribeFromMqttUpdates = function (): void {
  try {
    NodeMQTTOrchestrator.unregisterNode(this.nodeId);
  } catch (error) {
    logger.warn("Failed to unregister node from MQTT orchestrator", {
      nodeId: this.nodeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
