/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ScheduleItem } from "../../types/schedule";
import { ESPAPIResponse } from "../../types/output";
import {
  APICallValidationErrorCodes,
  ScheduleSuccessMessages,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPRMNeoNode class with the `removeSchedule` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Removes a schedule from this node by id, preserving other schedules.
     *
     * RainMaker's schedules API is replace-all, so this method does two round
     * trips: a GET to fetch the current list, then a PUT of the filtered list.
     *
     * @param scheduleId - Id of the schedule to remove.
     * @returns A promise that resolves with the API response when the schedule is removed.
     * @throws {ESPAPICallValidationError} If `scheduleId` is missing or no matching schedule exists.
     * @throws {Error} If the API request fails.
     */
    removeSchedule(scheduleId: string): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoNode.prototype.removeSchedule = async function (
  scheduleId: string
): Promise<ESPAPIResponse> {
  if (!scheduleId || typeof scheduleId !== "string" || !scheduleId.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_SCHEDULE_ID
    );
  }

  const existing = await this.getSchedules();
  const items: ScheduleItem[] = existing.map((s) => ({
    id: s.id,
    name: s.name,
    enabled: s.enabled,
    triggers: s.triggers,
    action: s.action,
    validity: s.validity,
  }));
  const filtered = items.filter((item) => item.id !== scheduleId);
  if (filtered.length === items.length) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.SCHEDULE_NOT_FOUND
    );
  }
  await this.createSchedule(filtered);
  return normalizeApiResponse(null, {
    message: ScheduleSuccessMessages.SET,
  });
};
