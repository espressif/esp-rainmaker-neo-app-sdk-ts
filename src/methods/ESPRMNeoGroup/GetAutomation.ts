/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPRMNeoAutomation } from "../../ESPRMNeoAutomation";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  AutomationItem,
  GetAutomationApiResponse,
} from "../../types/automation";
import { APIPathV1 } from "../../utils/constants";

/**
 * Augments the ESPRMNeoGroup class with the `getAutomation` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Retrieves a specific automation by its ID.
     *
     * Calls `GET /v1/groups/{groupId}/service/automations/{automationId}`.
     *
     * @param automationId - The ID of the automation to retrieve.
     * @returns A promise that resolves to an ESPRMNeoAutomation instance.
     * @throws {Error} If the automation is not found or the API request fails.
     */
    getAutomation(automationId: string): Promise<ESPRMNeoAutomation>;
  }
}

ESPRMNeoGroup.prototype.getAutomation = async function (
  automationId: string
): Promise<ESPRMNeoAutomation> {
  const endpoint = APIPathV1.groupAutomationId(
    this.groupId,
    automationId
  );
  const api = ESPSigV4APIManager.getInstance();
  const response = await api.get<GetAutomationApiResponse>(endpoint);
  return new ESPRMNeoAutomation(response as AutomationItem, this);
};
