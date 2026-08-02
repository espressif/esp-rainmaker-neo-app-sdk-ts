/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoTrigger } from "../../ESPRMNeoTrigger";
import { ESPAPIResponse } from "../../types/output";

/**
 * Augments the ESPRMNeoTrigger class with the `enable` method.
 */
declare module "../../ESPRMNeoTrigger" {
  interface ESPRMNeoTrigger {
    /**
     * Enables or disables this trigger.
     *
     * @param enabled - `true` to enable the trigger, `false` to disable it.
     * @returns A promise that resolves with the API response when the change succeeds.
     * @throws {ESPAPICallValidationError} If the node is not found.
     * @throws {Error} If the update fails or the API request fails.
     */
    enable(enabled: boolean): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoTrigger.prototype.enable = async function (
  this: ESPRMNeoTrigger,
  enabled: boolean
): Promise<ESPAPIResponse> {
  return this.update({ enabled });
};
