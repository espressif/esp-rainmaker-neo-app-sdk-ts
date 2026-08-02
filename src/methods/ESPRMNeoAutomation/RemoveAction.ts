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
 * Augments the ESPRMNeoAutomation class with the `removeAction` method.
 */
declare module "../../ESPRMNeoAutomation" {
  interface ESPRMNeoAutomation {
    /**
     * Removes an action from this automation by index. The instance is
     * updated only after the API call succeeds.
     *
     * @param index - The index of the action to remove.
     * @returns A promise that resolves with the API response.
     * @throws {ESPAPICallValidationError} If the index is out of range.
     */
    removeAction(index: number): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoAutomation.prototype.removeAction = async function (
  index: number
): Promise<ESPAPIResponse> {
  if (index < 0 || index >= this.actions.targets.length) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.INVALID_ACTION_INDEX
    );
  }
  const nextActions = {
    targets: this.actions.targets.filter((_, i) => i !== index),
  };
  const response = await this.update({ actions: nextActions });
  this.actions = nextActions;
  return response;
};
