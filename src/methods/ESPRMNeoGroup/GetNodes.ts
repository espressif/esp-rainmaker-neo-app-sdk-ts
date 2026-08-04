/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { concurrentFetchPool } from "../../utils/mapLimit";
import { GetNodeOptions } from "./GetNode";

/** Max concurrent `getNode` calls while loading a group’s node list. */
const GET_NODES_CONCURRENCY = 5;

/**
 * Options accepted by {@link ESPRMNeoGroup.getNodes}.
 * Same shape as {@link GetNodeOptions} — forwarded to each `getNode` call.
 */
export interface GetNodesOptions extends GetNodeOptions {}

/**
 * Augments the ESPRMNeoGroup class with the `getNodes` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Retrieves all nodes in this group.
     *
     * Forwards {@link GetNodesOptions} to each {@link ESPRMNeoGroup.getNode}
     * call. With `cache: true` (default), each node config is read from local
     * storage (`{@link StorageKeys.NODE_CONFIG_PREFIX}` + `nodeId`) when
     * present; with `cache: false`, configs are fetched from the cloud and
     * written back to local storage.
     *
     * @param options - See {@link GetNodesOptions}. Defaults to `{ cache: true }`.
     * @returns A promise that resolves to an array of ESPRMNeoNode instances.
     */
    getNodes(options?: GetNodesOptions): Promise<ESPRMNeoNode[]>;
  }
}

ESPRMNeoGroup.prototype.getNodes = async function (
  options?: GetNodesOptions
): Promise<ESPRMNeoNode[]> {
  const ids = this.nodeIds;
  if (!ids.length) return [];

  const nodes = await concurrentFetchPool(
    GET_NODES_CONCURRENCY,
    ids,
    (nodeId) => this.getNode(nodeId, options).catch(() => null)
  );
  return nodes.filter((node): node is ESPRMNeoNode => node != null);
};
