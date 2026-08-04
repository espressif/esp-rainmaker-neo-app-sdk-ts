/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPAPIResponse } from "../../types/output";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  APICallValidationErrorCodes,
  APIPathV1,
  GroupSuccessMessages,
  GroupUserAliases,
  HTTPMethods,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { resolveGroupPath } from "../../utils/groupUtils";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPRMNeoGroup class with the `removeMember` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Removes another member from this group (or subgroup).
     *
     * - Root group: `DELETE /v1/groups/{groupId}/users/{userId}`.
     * - Nested subgroup: `DELETE /v1/groups/{groupId}/subgroups/{subGroupId}/users/{userId}`.
     *
     * To remove the current (calling) user, use {@link ESPRMNeoGroup.leave} instead.
     *
     * @param userId - The ID of the user to remove. Must not be the caller.
     * @returns A promise that resolves with the API response.
     * @throws {ESPAPICallValidationError} If `userId` is empty or refers to the caller (use `leave()`).
     */
    removeMember(userId: string): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.removeMember = async function (
  userId: string
): Promise<ESPAPIResponse> {
  if (!userId?.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_USER_ID
    );
  }
  if (userId === GroupUserAliases.CURRENT) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.USE_LEAVE_FOR_CURRENT_USER
    );
  }
  const api = ESPSigV4APIManager.getInstance();
  const path = resolveGroupPath(
    this,
    APIPathV1.groupUser,
    APIPathV1.groupSubgroupUser,
    userId
  );
  const response = await api.request<ESPAPIResponse>(
    HTTPMethods.DELETE,
    path
  );
  return normalizeApiResponse(response, {
    message: GroupSuccessMessages.MEMBER_REMOVED,
  });
};
