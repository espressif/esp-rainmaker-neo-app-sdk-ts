/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPRMNeoBase } from "../../ESPRMNeoBase";

/**
 * Augments {@link ESPRMNeoNode} with per-node subscription channel-order methods.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Sets the subscription channel order for this node, overriding the global
     * order on {@link ESPRMNeoBase.subscriptionManager}. Channels are tried in
     * order until one succeeds; only channels that support the node are used.
     *
     * @param channelIds - Channel ids in priority order, e.g. `["matter", "mqtt"]`.
     *
     * @example
     * ```typescript
     * node.setSubscriptionChannelOrder(["matter", "mqtt"]);
     * ```
     */
    setSubscriptionChannelOrder(channelIds: string[]): void;

    /**
     * Returns the effective subscription channel order for this node
     * (node-specific order if set, otherwise the global order).
     *
     * @returns Channel ids in priority order.
     */
    getSubscriptionChannelOrder(): string[];

    /**
     * Clears the node-specific channel order so the node falls back to the
     * global order.
     */
    clearSubscriptionChannelOrder(): void;
  }
}

ESPRMNeoNode.prototype.setSubscriptionChannelOrder = function (
  channelIds: string[]
): void {
  if (!this.subscriptionConfig) {
    this.subscriptionConfig = {};
  }
  this.subscriptionConfig.channelOrder = channelIds;
};

ESPRMNeoNode.prototype.getSubscriptionChannelOrder = function (): string[] {
  return ESPRMNeoBase.subscriptionManager.getEffectiveChannelOrder(this);
};

ESPRMNeoNode.prototype.clearSubscriptionChannelOrder = function (): void {
  if (this.subscriptionConfig) {
    delete this.subscriptionConfig.channelOrder;
  }
};
