/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoSchedule } from "../../ESPRMNeoSchedule";
import { ESPAPIResponse } from "../../types/output";

/**
 * Augments the ESPRMNeoSchedule class with the `enable` method.
 */
declare module "../../ESPRMNeoSchedule" {
  interface ESPRMNeoSchedule {
    /**
     * Enables or disables this schedule.
     *
     * @param enabled - `true` to enable the schedule, `false` to disable it.
     * @returns A promise that resolves with the API response when the change succeeds.
     * @throws {ESPAPICallValidationError} If the node or schedule is not found.
     * @throws {Error} If the update fails or the API request fails.
     */
    enable(enabled: boolean): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoSchedule.prototype.enable = async function (
  this: ESPRMNeoSchedule,
  enabled: boolean
): Promise<ESPAPIResponse> {
  return this.update({ enabled });
};
