/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPAPIResponse } from "../../types/output";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APIPathV1, TriggerSuccessMessages } from "../../utils/constants";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPRMNeoNode class with the `removeAllTriggers` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Removes all triggers for this node in a single call.
     *
     * Calls `DELETE /v1/groups/{groupId}/nodes/{nodeId}/triggers`.
     *
     * @returns A promise that resolves with the API response when all triggers are successfully removed.
     * @throws {Error} If the API request fails.
     */
    removeAllTriggers(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoNode.prototype.removeAllTriggers =
  async function (): Promise<ESPAPIResponse> {
    const endpoint = APIPathV1.groupNodeTriggers(this.groupId, this.nodeId);
    const api = ESPSigV4APIManager.getInstance();
    const response = await api.delete<ESPAPIResponse>(endpoint);
    return normalizeApiResponse(response, {
      message: TriggerSuccessMessages.ALL_DELETED,
    });
  };
