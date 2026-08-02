/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoAutomation } from "../../ESPRMNeoAutomation";
import { ActionTarget } from "../../types/automation";
import { ESPAPIResponse } from "../../types/output";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoAutomation class with the `addAction` method.
 */
declare module "../../ESPRMNeoAutomation" {
  interface ESPRMNeoAutomation {
    /**
     * Adds an action target to this automation. The instance is updated only
     * after the API call succeeds.
     *
     * @param target - The action target to add.
     * @returns A promise that resolves with the API response.
     * @throws {ESPAPICallValidationError} If target is missing or missing required fields.
     */
    addAction(target: ActionTarget): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoAutomation.prototype.addAction = async function (
  target: ActionTarget
): Promise<ESPAPIResponse> {
  if (
    !target ||
    !String(target.node ?? "").trim() ||
    !String(target.path ?? "").trim()
  ) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.INVALID_ACTION_TARGET
    );
  }
  const nextActions = { targets: [...this.actions.targets, target] };
  const response = await this.update({ actions: nextActions });
  this.actions = nextActions;
  return response;
};
