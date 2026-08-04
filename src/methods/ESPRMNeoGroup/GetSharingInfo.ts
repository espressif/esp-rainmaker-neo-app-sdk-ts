/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  GroupSharingInfo,
  GroupUser,
  GroupUserInGroup,
  ListGroupUsersResponse,
} from "../../types/output";
import { APIPathV1, HTTPMethods } from "../../utils/constants";
import { resolveGroupPath } from "../../utils/groupUtils";

/**
 * Maps a wire-format group user entry to the public {@link GroupUser} shape.
 */
function mapGroupUser(user: GroupUserInGroup): GroupUser {
  return {
    userId: user.user_id,
    email: user.email,
    phoneNumber: user.phone_number,
    accessType: user.access_type,
    subgroups: user.subgroups,
  };
}

/**
 * Augments the ESPRMNeoGroup class with the `getSharingInfo` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Returns users with access to this group (email, phone number, access type, user id).
     *
     * Calls:
     * - Root group: `GET /v1/groups/{groupId}/users`
     * - Nested subgroup: `GET /v1/groups/{groupId}/subgroups/{subGroupId}/users`
     *
     * The listing scope is decided by the backend from the caller's access
     * level: primary callers see all members; secondary and subgroup-only
     * callers see only the group's primary owners.
     *
     * @returns A promise that resolves to a {@link GroupSharingInfo}.
     * @throws If the API request fails.
     */
    getSharingInfo(): Promise<GroupSharingInfo>;
  }
}

ESPRMNeoGroup.prototype.getSharingInfo = async function (): Promise<GroupSharingInfo> {
  const api = ESPSigV4APIManager.getInstance();
  const path = resolveGroupPath(
    this,
    APIPathV1.groupUsers,
    APIPathV1.groupSubgroupUsers
  );
  const response = await api.request<ListGroupUsersResponse>(
    HTTPMethods.GET,
    path
  );
  return {
    users: (response.users ?? []).map(mapGroupUser),
  };
};
