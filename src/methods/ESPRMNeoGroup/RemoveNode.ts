/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPAPIResponse } from "../../types/output";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  APIPathV1,
  GroupSuccessMessages,
  HTTPMethods,
} from "../../utils/constants";
import { resolveGroupPath } from "../../utils/groupUtils";
import { clearLocalNodeCache } from "../../utils/nodeUtils";

/**
 * Augments the ESPRMNeoGroup class with the `removeNode` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Removes a node association from this group.
     *
     * - Root group: `DELETE /v1/groups/{groupId}/nodes/{nodeId}` (full disassociation from the group).
     * - Nested subgroup: `DELETE /v1/groups/{groupId}/subgroups/{subGroupId}/nodes/{nodeId}` (removes from the subgroup only).
     */
    removeNode(nodeId: string): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.removeNode = async function (
  nodeId: string
): Promise<ESPAPIResponse> {
  const api = ESPSigV4APIManager.getInstance();
  const path = resolveGroupPath(
    this,
    APIPathV1.groupNode,
    APIPathV1.groupSubgroupNode,
    nodeId
  );
  const response = await api.request<ESPAPIResponse>(HTTPMethods.DELETE, path);
  this.nodeIds = this.nodeIds.filter((id) => id !== nodeId);

  // Safe even when the node remains in another group.
  await clearLocalNodeCache(nodeId);

  return normalizeApiResponse(response, {
    message: GroupSuccessMessages.NODE_REMOVED,
  });
};
