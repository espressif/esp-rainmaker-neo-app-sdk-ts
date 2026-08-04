/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoAutomation } from "../../ESPRMNeoAutomation";
import { ESPAPIResponse } from "../../types/output";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APIPathV1, AutomationSuccessMessages } from "../../utils/constants";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { Logger } from "../../utils/logger";

const logger = new Logger("AutomationDelete");

/**
 * Augments the ESPRMNeoAutomation class with the `delete` method.
 */
declare module "../../ESPRMNeoAutomation" {
  interface ESPRMNeoAutomation {
    /**
     * Deletes this automation. After a successful delete, the instance is
     * stale — callers should discard it.
     *
     * Calls `DELETE /v1/groups/{groupId}/service/automations/{automationId}`.
     *
     * @returns A promise that resolves with the API response when the automation is successfully deleted.
     * @throws If the API request fails.
     */
    delete(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoAutomation.prototype.delete = async function (): Promise<ESPAPIResponse> {
  try {
    const endpoint = APIPathV1.groupAutomationId(this.groupId, this.id);
    const api = ESPSigV4APIManager.getInstance();
    const response = await api.request<ESPAPIResponse>("DELETE", endpoint);
    return normalizeApiResponse(response, {
      message: AutomationSuccessMessages.AUTOMATION_DELETED,
    });
  } catch (err) {
    logger.error(
      "delete failed",
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
};
