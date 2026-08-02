/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPAPIResponse } from "../../types/output";
import {
  APICallValidationErrorCodes,
  TriggerSuccessMessages,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPRMNeoNode class with the `removeTrigger` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Removes a trigger from this node by id, preserving other triggers.
     *
     * RainMaker's triggers API is replace-all, so this method does two round
     * trips: a GET to fetch the current list, then a PUT of the filtered list.
     *
     * @param triggerId - Id of the trigger to remove.
     * @returns A promise that resolves with the API response when the trigger is removed.
     * @throws {ESPAPICallValidationError} If `triggerId` is missing or no matching trigger exists.
     * @throws {Error} If the API request fails.
     */
    removeTrigger(triggerId: string): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoNode.prototype.removeTrigger = async function (
  triggerId: string
): Promise<ESPAPIResponse> {
  if (!triggerId || typeof triggerId !== "string" || !triggerId.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_TRIGGER_ID
    );
  }

  const existing = await this.getTriggers();
  const filtered = existing.filter((t) => t.id !== triggerId);
  if (filtered.length === existing.length) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.TRIGGER_NOT_FOUND
    );
  }
  await this.createTrigger(filtered.map((t) => t.toTriggerItem()));
  return normalizeApiResponse(null, {
    message: TriggerSuccessMessages.SET,
  });
};
