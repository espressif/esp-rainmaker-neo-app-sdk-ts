/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { NodeConfig } from "../../types/output";

/**
 * Augments the ESPRMNeoNode class with the `getConfig` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Returns the node configuration currently held on this instance (the last
     * snapshot loaded from cache or fetched via {@link sync}). Synchronous —
     * does not hit the cloud. Call {@link sync} for a fresh fetch.
     *
     * @returns The current node configuration.
     */
    getConfig(): NodeConfig;
  }
}

ESPRMNeoNode.prototype.getConfig = function (): NodeConfig {
  return this.config;
};
