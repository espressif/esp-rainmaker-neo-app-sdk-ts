/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoSchedule } from "../../ESPRMNeoSchedule";
import { ESPAPIResponse } from "../../types/output";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoSchedule class with the `delete` method.
 */
declare module "../../ESPRMNeoSchedule" {
  interface ESPRMNeoSchedule {
    /**
     * Deletes this schedule.
     *
     * @returns A promise that resolves with the API response when the schedule is successfully deleted.
     * @throws {ESPAPICallValidationError} If the node is not found.
     * @throws {Error} If deletion fails or the API request fails.
     */
    delete(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoSchedule.prototype.delete = async function (
  this: ESPRMNeoSchedule
): Promise<ESPAPIResponse> {
  const node = await this.getNode();
  if (!node) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.SCHEDULE_NODE_NOT_FOUND
    );
  }
  return node.removeSchedule(this.id);
};
