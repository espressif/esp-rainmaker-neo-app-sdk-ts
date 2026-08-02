/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APIPathV1 } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("CreateGroup");

/**
 * Augments the ESPRMNeoUser class with the `createGroup` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Creates a new group.
     *
     * Calls `POST /v1/groups`.
     *
     * @param groupName Name of the group
     * @returns A promise that resolves to the created ESPRMNeoGroup
     */
    createGroup(groupName: string): Promise<ESPRMNeoGroup>;
  }
}

ESPRMNeoUser.prototype.createGroup = async function (
  groupName: string
): Promise<ESPRMNeoGroup> {
  logger.debug("createGroup called", { groupName });
  const api = ESPSigV4APIManager.getInstance();
  try {
    const response = await api.post<{ group_id: string }>(
      APIPathV1.GROUPS,
      { group_name: groupName }
    );
    logger.debug("createGroup succeeded", {
      groupId: response.group_id,
      groupName,
    });
    return new ESPRMNeoGroup({
      groupId: response.group_id,
      groupName,
      nodeIds: [],
      subgroups: [],
    });
  } catch (error) {
    logger.error("createGroup failed", {
      groupName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
