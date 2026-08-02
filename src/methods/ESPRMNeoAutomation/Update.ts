/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoAutomation } from "../../ESPRMNeoAutomation";
import { CreateAutomationInput } from "../../types/automation";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { ESPAPIResponse } from "../../types/output";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APIPathV1 } from "../../utils/constants";

/**
 * Augments the ESPRMNeoAutomation class with the `update` method.
 */
declare module "../../ESPRMNeoAutomation" {
  interface ESPRMNeoAutomation {
    /**
     * Updates this automation with partial changes. `id` cannot be changed.
     *
     * Calls `PUT /v1/groups/{groupId}/service/automations/{automationId}`.
     *
     * @param updates - Partial automation fields to update.
     * @returns A promise that resolves with the API response when the automation is successfully updated.
     * @throws {Error} If updating the automation fails or the API request fails.
     */
    update(updates: Partial<CreateAutomationInput>): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoAutomation.prototype.update = async function (
  updates: Partial<CreateAutomationInput>
): Promise<ESPAPIResponse> {
  if (updates.name !== undefined) {
    this.name = updates.name;
  }
  if (updates.conditions !== undefined) {
    this.conditions = updates.conditions;
  }
  if (updates.actions !== undefined) {
    this.actions = updates.actions;
  }
  if (updates.status !== undefined) {
    this.status = updates.status;
  }
  if (updates.retrigger !== undefined) {
    this.retrigger = updates.retrigger;
  }

  const endpoint = APIPathV1.groupAutomationId(this.groupId, this.id);
  const api = ESPSigV4APIManager.getInstance();
  const response = await api.request<ESPAPIResponse>("PUT", endpoint, {
    name: this.name,
    conditions: this.conditions,
    actions: this.actions,
    status: this.status,
    retrigger: this.retrigger,
  });
  return normalizeApiResponse(response, { message: "Automation updated successfully" });
};
