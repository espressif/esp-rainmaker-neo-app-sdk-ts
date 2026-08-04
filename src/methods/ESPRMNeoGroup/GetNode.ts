/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import {
  APICallValidationErrorCodes,
  StorageKeys,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import {
  fetchCloudNodeConfig,
  readLocalNodeConfig,
  toNeoNode,
} from "../../utils/nodeUtils";

/**
 * Options accepted by {@link ESPRMNeoGroup.getNode} and
 * {@link ESPRMNeoGroup.getNodes}.
 */
export interface GetNodeOptions {
  /**
   * Whether to use the local node-config cache.
   *
   * - `true` (default): read from local storage when a cached config exists.
   * - `false`: always fetch from the cloud and refresh local storage.
   *
   * Cache key: {@link StorageKeys.NODE_CONFIG_PREFIX} + `nodeId`.
   *
   * @defaultValue true
   */
  cache?: boolean;
}

/**
 * Augments the ESPRMNeoGroup class with the `getNode` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Retrieves a specific node from this group by node ID.
     *
     * Cloud paths:
     * - Root: `GET /v1/groups/{groupId}/nodes/{nodeId}/config`
     * - Nested: `GET /v1/groups/{groupId}/subgroups/{subGroupId}/nodes/{nodeId}/config`
     *
     * With `cache: true` (default), uses local storage when present; otherwise
     * fetches from the cloud. With `cache: false`, always fetches from the cloud.
     *
     * **Multi-subgroup nodes:** call `getNode` on the **root group** so all
     * subgroup memberships are discovered for the correct MQTT shadow name.
     *
     * @param nodeId - The ID of the node to retrieve.
     * @param options - See {@link GetNodeOptions}. Defaults to `{ cache: true }`.
     * @returns A promise that resolves to an ESPRMNeoNode instance.
     * @throws {ESPAPICallValidationError} If the node config could not be resolved.
     * @throws {Error} If the API request fails.
     */
    getNode(nodeId: string, options?: GetNodeOptions): Promise<ESPRMNeoNode>;
  }
}

ESPRMNeoGroup.prototype.getNode = async function (
  nodeId: string,
  options?: GetNodeOptions
): Promise<ESPRMNeoNode> {
  const useCache = options?.cache ?? true;

  const local = useCache ? await readLocalNodeConfig(nodeId) : null;
  const config = local ?? (await fetchCloudNodeConfig(this, nodeId));

  if (!config) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.NODE_CONFIG_UNRESOLVED
    );
  }

  return toNeoNode(this, config, nodeId);
};
