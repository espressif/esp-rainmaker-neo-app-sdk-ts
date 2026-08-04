/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import { NodeMappingHelper } from "../../services/ESPRMNeoHelpers/NodeMappingHelper";

/**
 * Augments the ESPDevice class with the `initiateUserNodeMapping` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Initiates a user node mapping request.
     * @param requestBody - The request body for the user node mapping.
     * @returns A promise that resolves to the response from the API.
     */
    initiateUserNodeMapping(groupId: string,
      requestBody?: Record<string, unknown>
    ): Promise<unknown>;
  }
}

ESPDevice.prototype.initiateUserNodeMapping = async function (
  groupId: string,
  requestBody: Record<string, unknown> = {}
): Promise<unknown> {
  return NodeMappingHelper.initiateUserNodeMapping(groupId, requestBody);
};
