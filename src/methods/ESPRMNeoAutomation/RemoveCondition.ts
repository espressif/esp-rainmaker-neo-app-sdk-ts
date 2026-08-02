/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoAutomation } from "../../ESPRMNeoAutomation";
import { ESPAPIResponse } from "../../types/output";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoAutomation class with the `removeCondition` method.
 */
declare module "../../ESPRMNeoAutomation" {
  interface ESPRMNeoAutomation {
    /**
     * Removes a condition (trigger id) from this automation. The instance is
     * updated only after the API call succeeds.
     *
     * @param triggerId - The trigger id to remove from conditions.
     * @returns A promise that resolves with the API response.
     * @throws {ESPAPICallValidationError} If triggerId is missing or empty.
     */
    removeCondition(triggerId: string): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoAutomation.prototype.removeCondition = async function (
  triggerId: string
): Promise<ESPAPIResponse> {
  if (!triggerId?.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_TRIGGER_ID
    );
  }
  const nextConditions = {
    and: this.conditions.and.filter((id) => id !== triggerId),
  };
  const response = await this.update({ conditions: nextConditions });
  this.conditions = nextConditions;
  return response;
};
