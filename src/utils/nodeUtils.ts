/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup, isChildGroup } from "../ESPRMNeoGroup";
import { ESPRMNeoNode } from "../ESPRMNeoNode";
import { ESPSigV4APIManager } from "../services/ESPSigV4APIManager";
import { ESPRMNeoStorage } from "../services/ESPRMNeoStorage/ESPRMNeoStorage";
import { NodeConfigAPI } from "../types/output";
import { APIPathV1, NodeWarnMessages } from "./constants";
import { Logger } from "./logger";
import { clearNcfgVersionMarker } from "./nodeNcfgVersionHandler";

const logger = new Logger("nodeUtils");

/** Sorted subgroup IDs under this group that contain `nodeId`. */
export function collectSubgroupIdsForNode(
  group: ESPRMNeoGroup,
  nodeId: string
): string[] {
  return group.subgroups
    .filter((sg) => sg.nodeIds.includes(nodeId))
    .map((sg) => sg.groupId)
    .sort();
}

/** Read node config from local storage. Returns null on miss or corrupt data. */
export async function readLocalNodeConfig(
  nodeId: string
): Promise<NodeConfigAPI | null> {
  return ESPRMNeoStorage.getNodeConfig(nodeId);
}

/** Best-effort persist of node config to local storage. */
export async function writeLocalNodeConfig(
  nodeId: string,
  config: NodeConfigAPI
): Promise<void> {
  try {
    let toStore = config;
    // Cloud config omits connectivity — keep the last cached status when writing.
    if (!config.connectivity_status) {
      const prev = await ESPRMNeoStorage.getNodeConfig(nodeId);
      if (prev?.connectivity_status) {
        toStore = {
          ...config,
          connectivity_status: prev.connectivity_status,
        };
      }
    }
    await ESPRMNeoStorage.setNodeConfig(nodeId, toStore);
  } catch (error) {
    logger.warn(`Cache write failed for ${nodeId}`, error);
  }
}

/** Best-effort removal of node config from local storage. */
export async function removeLocalNodeConfig(nodeId: string): Promise<void> {
  try {
    await ESPRMNeoStorage.deleteNodeConfig(nodeId);
  } catch (error) {
    logger.warn(NodeWarnMessages.NODE_CONFIG_CACHE_REMOVE_FAILED, {
      nodeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Best-effort clear of the ncfg version marker.
 * Safe even when the node remains associated to another group — the marker
 * will re-baseline on the next shadow update.
 */
export async function clearLocalNcfgVersionMarker(
  nodeId: string
): Promise<void> {
  try {
    await clearNcfgVersionMarker(nodeId);
  } catch (error) {
    logger.warn(NodeWarnMessages.NCFG_VERSION_MARKER_CLEAR_FAILED, {
      nodeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Best-effort cleanup of local node config cache + ncfg version marker.
 * Safe even when the node remains associated to another group.
 */
export async function clearLocalNodeCache(nodeId: string): Promise<void> {
  await removeLocalNodeConfig(nodeId);
  await clearLocalNcfgVersionMarker(nodeId);
}

/**
 * Fetch node config from the cloud.
 *
 * Config is always served on the root-group route — the subgroup variant
 * (`…/subgroups/{sgid}/nodes/{nid}/config`) does not exist in the backend
 * (verified against the backend source: the gateway defines only PUT/DELETE on
 * subgroup nodes). Subgroup-scoped users still pass the access check here
 * because the user↔group mapping is keyed on the root group id.
 */
export async function fetchCloudNodeConfigForNode(
  groupId: string,
  nodeId: string
): Promise<NodeConfigAPI> {
  const path = APIPathV1.groupNodeConfig(groupId, nodeId);
  return ESPSigV4APIManager.getInstance().get<NodeConfigAPI>(path);
}

/** Fetch node config from the cloud and best-effort write it to local storage. */
export async function fetchCloudNodeConfig(
  group: ESPRMNeoGroup,
  nodeId: string
): Promise<NodeConfigAPI> {
  // Root-group id even for child groups — see fetchCloudNodeConfigForNode.
  const rootGroupId = isChildGroup(group) ? group.parentId! : group.groupId;
  const config = await fetchCloudNodeConfigForNode(rootGroupId, nodeId);
  await writeLocalNodeConfig(nodeId, config);
  return config;
}

/** Wrap a resolved config in an ESPRMNeoNode for this group context. */
export function toNeoNode(
  group: ESPRMNeoGroup,
  config: NodeConfigAPI,
  nodeId: string
): ESPRMNeoNode {
  if (!config.node_id) {
    config.node_id = nodeId;
  }

  if (isChildGroup(group)) {
    return new ESPRMNeoNode(config, group.parentId!, group.groupId);
  }

  return new ESPRMNeoNode(
    config,
    group.groupId,
    collectSubgroupIdsForNode(group, nodeId)
  );
}
