/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup, isChildGroup } from "../../ESPRMNeoGroup";
import { NodeMQTTOrchestrator } from "../../services/NodeMQTTOrchestrator";
import { ESPRMNeoGroupSetParamsOptions } from "../../types/group";
import { ESPAPIResponse } from "../../types/output";
import { GroupSuccessMessages } from "../../utils/constants";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPRMNeoGroup class with the `setParams` method (group control).
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Sends a parameter payload to all devices in this group (or one subgroup) via the
     * group control MQTT topic. Same JSON shape as {@link ESPRMNeoNode.setParams}.
     *
     * - Root group: omit `subgroupId` for a group-wide broadcast, or pass `subgroupId`
     *   to address one subgroup.
     * - Nested subgroup instance: always targets that subgroup using the parent group's
     *   MQTT namespace.
     */
    setParams(
      params: Record<string, any>,
      options?: ESPRMNeoGroupSetParamsOptions
    ): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.setParams = async function (
  params: Record<string, any>,
  options?: ESPRMNeoGroupSetParamsOptions
): Promise<ESPAPIResponse> {
  let groupId: string;
  let subgroupId: string | undefined;

  if (isChildGroup(this)) {
    groupId = this.parentId as string;
    subgroupId = this.groupId;
  } else {
    groupId = this.groupId;
    subgroupId = options?.subgroupId;
  }

  await NodeMQTTOrchestrator.setGroupParams(groupId, params, subgroupId);
  return normalizeApiResponse(null, {
    message: GroupSuccessMessages.PARAMS_SET,
  });
};
