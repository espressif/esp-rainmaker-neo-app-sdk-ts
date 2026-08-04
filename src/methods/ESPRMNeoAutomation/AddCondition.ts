/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoAutomation } from "../../ESPRMNeoAutomation";
import { ESPAPIResponse } from "../../types/output";
import {
  APICallValidationErrorCodes,
  AutomationSuccessMessages,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPRMNeoAutomation class with the `addCondition` method.
 */
declare module "../../ESPRMNeoAutomation" {
  interface ESPRMNeoAutomation {
    /**
     * Adds a condition (trigger id) to this automation. The instance is
     * updated only after the API call succeeds.
     *
     * @param triggerId - The trigger id to add to conditions.
     * @returns A promise that resolves with the API response.
     * @throws {ESPAPICallValidationError} If triggerId is missing or empty.
     */
    addCondition(triggerId: string): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoAutomation.prototype.addCondition = async function (
  triggerId: string
): Promise<ESPAPIResponse> {
  if (!triggerId?.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_TRIGGER_ID
    );
  }
  if (this.conditions.and.includes(triggerId)) {
    return normalizeApiResponse(null, {
      message: AutomationSuccessMessages.CONDITION_ALREADY_ADDED,
    });
  }
  const nextConditions = { and: [...this.conditions.and, triggerId] };
  const response = await this.update({ conditions: nextConditions });
  this.conditions = nextConditions;
  return response;
};
