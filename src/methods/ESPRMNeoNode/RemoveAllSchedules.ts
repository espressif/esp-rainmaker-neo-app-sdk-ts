/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPAPIResponse } from "../../types/output";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APIPathV1, ScheduleSuccessMessages } from "../../utils/constants";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPRMNeoNode class with the `removeAllSchedules` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Removes all schedules for this node in a single call.
     *
     * Calls `DELETE /v1/groups/{groupId}/nodes/{nodeId}/schedules`.
     *
     * @returns A promise that resolves with the API response when all schedules are successfully removed.
     * @throws {Error} If the API request fails.
     */
    removeAllSchedules(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoNode.prototype.removeAllSchedules =
  async function (): Promise<ESPAPIResponse> {
    const endpoint = APIPathV1.groupNodeSchedules(this.groupId, this.nodeId);
    const api = ESPSigV4APIManager.getInstance();
    const response = await api.delete<ESPAPIResponse>(endpoint);
    return normalizeApiResponse(response, {
      message: ScheduleSuccessMessages.ALL_DELETED,
    });
  };
