/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoTrigger } from "../../ESPRMNeoTrigger";
import { ESPAPIResponse } from "../../types/output";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoTrigger class with the `delete` method.
 */
declare module "../../ESPRMNeoTrigger" {
  interface ESPRMNeoTrigger {
    /**
     * Deletes this trigger.
     *
     * @returns A promise that resolves with the API response when the trigger is successfully deleted.
     * @throws {Error} If deletion fails.
     */
    delete(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoTrigger.prototype.delete = async function (): Promise<ESPAPIResponse> {
  const node = this.getNode();
  if (!node) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_NODE_REF
    );
  }
  return node.removeTrigger(this.id);
};
