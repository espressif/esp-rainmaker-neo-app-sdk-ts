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
  CreateAutomationApiResponse,
  CreateAutomationInput,
} from "../../types/automation";
import { APICallValidationErrorCodes, APIPathV1 } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoGroup class with the `createAutomation` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Creates a new automation for this group. The server mints the id.
     *
     * Calls `POST /v1/groups/{groupId}/service/automations`.
     *
     * @param input - The automation fields (name, conditions, actions, …).
     * @returns A promise that resolves to the created ESPRMNeoAutomation instance.
     * @throws {ESPAPICallValidationError} If name, conditions, or actions are missing.
     * @throws {Error} If automation creation fails or the API request fails.
     */
    createAutomation(
      input: CreateAutomationInput
    ): Promise<ESPRMNeoAutomation>;
  }
}

ESPRMNeoGroup.prototype.createAutomation = async function (
  input: CreateAutomationInput
): Promise<ESPRMNeoAutomation> {
  if (!input.name?.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_AUTOMATION_NAME
    );
  }
  if (!input.conditions) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_AUTOMATION_CONDITIONS
    );
  }
  if (!input.actions) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_AUTOMATION_ACTIONS
    );
  }

  const endpoint = APIPathV1.groupAutomation(this.groupId);
  const api = ESPSigV4APIManager.getInstance();
  // Strip any local `id` before sending — the server mints the id on creation.
  const { id: _dropId, ...payload } = input as AutomationItem;
  void _dropId;
  const response = await api.post<CreateAutomationApiResponse>(endpoint, payload);
  const createdItem: AutomationItem = { ...payload, id: response.automation_id };
  return new ESPRMNeoAutomation(createdItem, this);
};
