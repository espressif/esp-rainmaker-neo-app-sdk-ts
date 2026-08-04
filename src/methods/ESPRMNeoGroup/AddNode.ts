/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup, isChildGroup } from "../../ESPRMNeoGroup";
import { ESPAPIResponse } from "../../types/output";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  APICallValidationErrorCodes,
  APIPathV1,
  GroupSuccessMessages,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoGroup class with the `addNode` method (nested groups only).
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Adds a node to this nested group (subgroup API).
     *
     * Calls `PUT /v1/groups/{groupId}/subgroups/{subGroupId}/nodes/{nodeId}`.
     *
     * @throws {ESPAPICallValidationError} If this is a root group or the node is already present.
     */
    addNode(nodeId: string): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.addNode = async function (
  nodeId: string
): Promise<ESPAPIResponse> {
  if (!isChildGroup(this)) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.ADD_NODE_REQUIRES_NESTED_GROUP
    );
  }
  if (this.nodeIds.includes(nodeId)) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.NODE_ALREADY_IN_GROUP
    );
  }
  const api = ESPSigV4APIManager.getInstance();
  const path = APIPathV1.groupSubgroupNode(this.parentId!, this.groupId, nodeId);
  const response = await api.request<ESPAPIResponse>("PUT", path);
  this.nodeIds.push(nodeId);
  return normalizeApiResponse(response, {
    message: GroupSuccessMessages.NODE_ADDED,
  });
};
