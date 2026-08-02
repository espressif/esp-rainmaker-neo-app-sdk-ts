/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPAPIResponse } from "../../types/output";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  APIPathV1,
  GroupSuccessMessages,
  GroupUserAliases,
  HTTPMethods,
} from "../../utils/constants";
import { resolveGroupPath } from "../../utils/groupUtils";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPRMNeoGroup class with the `leave` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Leaves this group (or subgroup) by removing the current (calling) user.
     *
     * Calls the remove-member API with the `'me'` path alias so the server
     * resolves the authenticated caller:
     * - Root group: `DELETE /v1/groups/{groupId}/users/{userId}` with `userId=me`.
     * - Nested subgroup: `DELETE /v1/groups/{groupId}/subgroups/{subGroupId}/users/{userId}` with `userId=me`.
     *
     * The last remaining Primary user cannot leave; the group must always
     * have at least one Primary.
     *
     * @returns A promise that resolves with the API response when the user has left.
     * @throws If the request fails, the caller is not a member, or the caller
     *   is the last remaining Primary user.
     */
    leave(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.leave = async function (): Promise<ESPAPIResponse> {
  const api = ESPSigV4APIManager.getInstance();

  const path = resolveGroupPath(
    this,
    APIPathV1.groupUser,
    APIPathV1.groupSubgroupUser,
    GroupUserAliases.CURRENT
  );

  const response = await api.request<ESPAPIResponse>(
    HTTPMethods.DELETE,
    path
  );
  return normalizeApiResponse(response, {
    message: GroupSuccessMessages.LEFT_GROUP,
  });
};
