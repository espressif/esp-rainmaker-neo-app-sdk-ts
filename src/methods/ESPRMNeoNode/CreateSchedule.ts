/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPRMNeoSchedule } from "../../ESPRMNeoSchedule";
import { ScheduleItem } from "../../types/schedule";
import { ESPAPIResponse } from "../../types/output";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APICallValidationErrorCodes, APIPathV1 } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoNode class with the `createSchedule` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Creates schedules on this node.
     *
     * - Pass a single {@link ScheduleItem} to append it while preserving existing
     *   schedules (GET current list, then PUT the merged list).
     * - Pass an array to replace all schedules in one PUT. Pass `[]` to clear.
     *
     * Calls `PUT /v1/groups/{groupId}/nodes/{nodeId}/schedules`.
     *
     * Single-item append is not safe under concurrent calls to the same node —
     * two simultaneous creates can read the same existing list and the later
     * PUT wins. Callers appending many schedules should build the array locally
     * and pass it once.
     *
     * @param schedules - One schedule to append, or the full list to set.
     * @returns The created schedule, or the full list after a replace-all PUT.
     * @throws {ESPAPICallValidationError} If the argument is invalid, or a single
     *   schedule's id is missing / already exists.
     * @throws {Error} If the API request fails.
     */
    createSchedule(schedule: ScheduleItem): Promise<ESPRMNeoSchedule>;
    createSchedule(schedules: ScheduleItem[]): Promise<ESPRMNeoSchedule[]>;
  }
}

ESPRMNeoNode.prototype.createSchedule = async function (
  this: ESPRMNeoNode,
  schedules: ScheduleItem | ScheduleItem[]
): Promise<ESPRMNeoSchedule | ESPRMNeoSchedule[]> {
  if (Array.isArray(schedules)) {
    const endpoint = APIPathV1.groupNodeSchedules(this.groupId, this.nodeId);
    const api = ESPSigV4APIManager.getInstance();
    await api.put<ESPAPIResponse>(endpoint, {
      schedules,
    });
    return schedules.map(
      (schedule) =>
        new ESPRMNeoSchedule(
          schedule,
          this.nodeId,
          this.groupId,
          schedule.id,
          this
        )
    );
  }

  const schedule = schedules;
  if (!schedule || typeof schedule !== "object") {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_SCHEDULE
    );
  }
  if (!schedule.id || typeof schedule.id !== "string" || !schedule.id.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_SCHEDULE_ID
    );
  }

  // Schedules API is replace-all: fetch the current list, append, PUT the merged
  // set. No cache — see scheduleUtils.ts for the rationale.
  const existing = await this.getSchedules();
  if (existing.some((s) => s.id === schedule.id)) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.SCHEDULE_ALREADY_EXISTS
    );
  }
  const existingItems: ScheduleItem[] = existing.map((s) => ({
    id: s.id,
    name: s.name,
    enabled: s.enabled,
    triggers: s.triggers,
    action: s.action,
    validity: s.validity,
  }));
  const created = await this.createSchedule([...existingItems, schedule]);
  return created.find((s) => s.id === schedule.id)!;
} as ESPRMNeoNode["createSchedule"];
