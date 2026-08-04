/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoSchedule } from "../../ESPRMNeoSchedule";
import { ScheduleItem } from "../../types/schedule";
import { ESPAPIResponse } from "../../types/output";
import {
  APICallValidationErrorCodes,
  ScheduleSuccessMessages,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import {
  getScheduleItemsForNode,
  scheduleToItem,
} from "../../utils/scheduleUtils";

/**
 * Augments the ESPRMNeoSchedule class with the `update` method.
 */
declare module "../../ESPRMNeoSchedule" {
  interface ESPRMNeoSchedule {
    /**
     * Updates this schedule with partial changes.
     *
     * @param updates - Partial schedule data containing fields to update.
     * @returns A promise that resolves with the API response when the schedule is successfully updated.
     * @throws {ESPAPICallValidationError} If the node or schedule is not found.
     * @throws {Error} If the update fails or the API request fails.
     */
    update(updates: Partial<ScheduleItem>): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoSchedule.prototype.update = async function (
  this: ESPRMNeoSchedule,
  updates: Partial<ScheduleItem>
): Promise<ESPAPIResponse> {
  const node = await this.getNode();
  if (!node) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.SCHEDULE_NODE_NOT_FOUND
    );
  }

  const items = await getScheduleItemsForNode(node);
  const index = items.findIndex((item) => item.id === this.id);
  if (index === -1) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.SCHEDULE_NOT_FOUND
    );
  }

  // Build the intended item WITHOUT touching `this.*`. Only after the PUT
  // succeeds do we commit the changes to the instance — otherwise a failed
  // network call leaves the instance in a state that doesn't reflect the
  // cloud.
  const updatedItem: ScheduleItem = {
    ...scheduleToItem(this),
    ...updates,
  };
  items[index] = updatedItem;

  await node.createSchedule(items);

  // PUT succeeded — commit the local changes now so subsequent reads reflect
  // what's actually in the cloud.
  if (updates.enabled !== undefined) this.enabled = updates.enabled;
  if (updates.triggers !== undefined) this.triggers = updates.triggers;
  if (updates.action !== undefined) this.action = updates.action;
  if (updates.validity !== undefined) this.validity = updates.validity;
  if (updates.name !== undefined) this.name = updates.name;

  return normalizeApiResponse(null, {
    message: ScheduleSuccessMessages.SET,
  });
};
