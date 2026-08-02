/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPAPIResponse } from "../../types/output";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APICallValidationErrorCodes, APIPathV1, GroupSuccessMessages } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import {
  buildGroupNameBody,
  resolveGroupPath,
} from "../../utils/groupUtils";
import { Logger } from "../../utils/logger";

const logger = new Logger("UpdateName");

/**
 * Augments the ESPRMNeoGroup class with the `updateName` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Updates the name of this group.
     *
     * Calls:
     * - Root group: `PATCH /v1/groups/{groupId}`
     * - Nested subgroup: `PATCH /v1/groups/{groupId}/subgroups/{subGroupId}`
     *
     * @param newName - The new name for the group.
     * @returns A promise that resolves with the API response when the name is successfully updated.
     * @throws {Error} If updating the name fails or the API request fails.
     */
    updateName(newName: string): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.updateName = async function (
  newName: string
): Promise<ESPAPIResponse> {
  const trimmedName = newName?.trim();
  if (!trimmedName) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_GROUP_NAME
    );
  }

  try {
    const api = ESPSigV4APIManager.getInstance();
    const path = resolveGroupPath(
      this,
      APIPathV1.group,
      APIPathV1.groupSubgroup
    );
    const body = buildGroupNameBody(this, trimmedName);
    const response = await api.patch<ESPAPIResponse>(path, body);

    this.groupName = trimmedName;
    return normalizeApiResponse(response, {
      message: GroupSuccessMessages.NAME_UPDATED,
    });
    
  } catch (error) {
    logger.error(
      "updateName failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};
