/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoTrigger } from "../../ESPRMNeoTrigger";
import { TriggerItem } from "../../types/trigger";
import { ESPAPIResponse } from "../../types/output";
import {
  APICallValidationErrorCodes,
  TriggerSuccessMessages,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import {
  applyTriggerUpdates,
  getTriggerItemsForNode,
  mergeTriggerItem,
  triggerToItem,
} from "../../utils/triggerUtils";

/**
 * Augments the ESPRMNeoTrigger class with the `update` method.
 */
declare module "../../ESPRMNeoTrigger" {
  interface ESPRMNeoTrigger {
    /**
     * Updates this trigger with partial changes. Sends a full trigger-list
     * PUT under the hood (the RainMaker triggers API is replace-all).
     *
     * The instance is mutated **only after** the API call succeeds. If the
     * PUT fails, this trigger's fields are left unchanged.
     *
     * @param updates - Partial trigger fields to update.
     * @returns A promise that resolves with the API response.
     * @throws {ESPAPICallValidationError} If the node or trigger is not found.
     * @throws {Error} If the API request fails.
     */
    update(updates: Partial<TriggerItem>): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoTrigger.prototype.update = async function (
  this: ESPRMNeoTrigger,
  updates: Partial<TriggerItem>
): Promise<ESPAPIResponse> {
  const node = this.getNode();
  if (!node) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_NODE_REF
    );
  }

  const items = await getTriggerItemsForNode(node);
  const index = items.findIndex((item) => item.id === this.id);
  if (index === -1) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.TRIGGER_NOT_FOUND
    );
  }

  // Build the merged plain item WITHOUT mutating `this`. Instance fields
  // are updated only after the server accepts the change (below).
  items[index] = mergeTriggerItem(triggerToItem(this), updates);

  await node.createTrigger(items);

  // Server accepted — now reflect the change on the instance.
  applyTriggerUpdates(this, updates);

  return normalizeApiResponse(null, {
    message: TriggerSuccessMessages.SET,
  });
};
