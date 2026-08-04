/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { APICallValidationErrorCodes, APIPathV1 } from "../../utils/constants";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { CreateSubgroupResponse } from "../../types/output";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { Logger } from "../../utils/logger";

const logger = new Logger("CreateSubGroup");

/**
 * Augments the ESPRMNeoGroup class with the `createSubGroup` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Creates a new nested group (subgroup) under this group.
     *
     * Calls `POST /v1/groups/{groupId}/subgroups`.
     *
     * @param name - The name for the new nested group.
     * @returns A promise that resolves to the created child {@link ESPRMNeoGroup} (`parentId` set).
     * @throws {Error} If the API request fails.
     */
    createSubGroup(name: string): Promise<ESPRMNeoGroup>;
  }
}

ESPRMNeoGroup.prototype.createSubGroup = async function (
  name: string
): Promise<ESPRMNeoGroup> {
  if (!name?.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_GROUP_NAME
    );
  }

  try {
    const api = ESPSigV4APIManager.getInstance();
    const path = APIPathV1.groupSubgroups(this.groupId);
    const response = await api.request<CreateSubgroupResponse>("POST", path, {
      subgroup_name: name,
    });
    const newChild = new ESPRMNeoGroup({
      groupId: response.subgroup_id,
      groupName: name,
      parentId: this.groupId,
      nodeIds: [],
    });
    this.subgroups.push(newChild);
    return newChild;
  } catch (error) {
    logger.error(
      "createSubGroup failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};
