/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import {
  fetchCloudNodeConfigForNode,
  writeLocalNodeConfig,
} from "../../utils/nodeUtils";
import { Logger } from "../../utils/logger";

const logger = new Logger("NodeSync");

/**
 * Augments the ESPRMNeoNode class with the `sync` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Fetches the latest node config from the cloud, applies it to this
     * instance (config, devices, services), then updates the local cache.
     *
     * Calls:
     * - Root membership: `GET /v1/groups/{groupId}/nodes/{nodeId}/config`
     * - Subgroup membership: `GET /v1/groups/{groupId}/subgroups/{subGroupId}/nodes/{nodeId}/config`
     *
     * @throws {Error} If the API request fails.
     */
    sync(): Promise<ESPRMNeoNode>;
  }
}

ESPRMNeoNode.prototype.sync = async function (): Promise<ESPRMNeoNode> {
  try {
    const config = await fetchCloudNodeConfigForNode(this.groupId, this.nodeId);

    // Apply first so a schema issue surfaces to the caller instead of
    // poisoning the storage cache for the next cold start.
    this.applyNodeConfig(config);
    await writeLocalNodeConfig(this.nodeId, config);

    return this;
  } catch (error) {
    logger.error("sync failed", {
      nodeId: this.nodeId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
