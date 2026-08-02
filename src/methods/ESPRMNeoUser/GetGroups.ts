/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  ESPNodeGroupsResponse,
  ESPNodeGroup,
  Subgroup,
  ESPRMNeoGroup as ESPRMNeoGroupData,
} from "../../types/output";
import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { Logger } from "../../utils/logger";
import { APIPathV1 } from "../../utils/constants";

const logger = new Logger("GetGroups");

/**
 * Maps a wire-format subgroup to a plain {@link ESPRMNeoGroupData} (child with `parentId`).
 */
function transformSubgroup(
  subgroup: Subgroup,
  parentGroupId: string
): ESPRMNeoGroupData {
  return {
    groupId: subgroup.subgroup_id,
    groupName: subgroup.subgroup_name,
    parentId: parentGroupId,
    nodeIds: subgroup.node_ids,
  };
}

/**
 * Transforms a group from API format (snake_case) to ESPRMNeoGroup instance.
 */
function transformGroup(group: ESPNodeGroup): ESPRMNeoGroup {
  const groupData: ESPRMNeoGroupData = {
    groupId: group.group_id,
    groupName: group.group_name,
    accessType: group.access_type,
    nodeIds: group.node_ids,
    subgroups: group.subgroups?.map((subgroup) =>
      transformSubgroup(subgroup, group.group_id)
    ),
    nodeDetails: group.node_details,
  };
  return new ESPRMNeoGroup(groupData);
}

/**
 * Augments the ESPRMNeoUser class with the `getGroups` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Retrieves the list of groups associated with the user.
     *
     * Calls `GET /v1/groups`.
     *
     * @returns A promise that resolves to an array of ESPRMNeoGroup instances
     */
    getGroups(): Promise<ESPRMNeoGroup[]>;
  }
}

/**
 * Implementation of the `getGroups` method for the `ESPRMNeoUser` class.
 */
ESPRMNeoUser.prototype.getGroups = async function (): Promise<ESPRMNeoGroup[]> {
  logger.debug("getGroups called");
  try {
    const response = await ESPSigV4APIManager.getInstance().request<ESPNodeGroupsResponse>(
      "GET",
      APIPathV1.GROUPS
    );
    return (response.groups ?? []).map(transformGroup);
  } catch (error) {
    logger.error(
      "getGroups failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};
