/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import { NodeMappingHelper } from "../../services/ESPRMNeoHelpers/NodeMappingHelper";
import { ESPAPIResponse } from "../../types/output";

/**
 * Augments the ESPDevice class with the `verifyUserNodeMapping` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Verifies the mapping between a user and a node.
     * @param groupId - The ID of the group.
     * @param requestId - The node association request ID.
     * @param requestBody - The request body for the user node mapping verification.
     * @returns A promise that resolves to the response from the API.
     */
    verifyUserNodeMapping(
      groupId: string,
      requestId: string,
      requestBody?: Record<string, unknown>
    ): Promise<ESPAPIResponse>;
  }
}

ESPDevice.prototype.verifyUserNodeMapping = async function (
  groupId: string,
  requestId: string,
  requestBody: Record<string, unknown> = {}
): Promise<ESPAPIResponse> {
  return NodeMappingHelper.verifyUserNodeMapping(
    groupId,
    requestId,
    requestBody
  ) as Promise<ESPAPIResponse>;
};
