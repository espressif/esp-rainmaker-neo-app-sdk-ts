/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScheduleItem } from "../../types/schedule";
import { APICallValidationErrorCodes } from "../constants";
import { ESPAPICallValidationError } from "../error/ESPAPICallValidationError";
import { isNonEmptyString, isValidObject } from "./validators";

/**
 * Validates schedule payloads used by group/node schedule APIs.
 */
export class ScheduleValidator {
  /**
   * Validates the `nodeSchedules` argument for `createSchedule`.
   *
   * @param nodeSchedules - Per-node schedule batches to validate.
   * @throws {ESPAPICallValidationError} If the payload shape is invalid.
   */
  static validateNodeSchedules(
    nodeSchedules: Array<{ nodeId: string; schedules: ScheduleItem[] }>
  ): void {
    if (!Array.isArray(nodeSchedules)) {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.INVALID_NODE_SCHEDULES
      );
    }

    for (const { nodeId, schedules } of nodeSchedules) {
      if (!isNonEmptyString(nodeId)) {
        throw new ESPAPICallValidationError(
          APICallValidationErrorCodes.MISSING_NODE_ID
        );
      }
      if (!Array.isArray(schedules)) {
        throw new ESPAPICallValidationError(
          APICallValidationErrorCodes.INVALID_SCHEDULES
        );
      }
      for (const schedule of schedules) {
        ScheduleValidator.validateScheduleItem(schedule);
      }
    }
  }

  /**
   * Validates a single schedule item.
   *
   * @param item - The schedule item to validate.
   * @throws {ESPAPICallValidationError} If required fields are missing or invalid.
   */
  static validateScheduleItem(item: ScheduleItem): void {
    if (typeof item?.enabled !== "boolean") {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.INVALID_SCHEDULE_ENABLED
      );
    }
    if (!Array.isArray(item.triggers)) {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.INVALID_SCHEDULE_TRIGGERS
      );
    }
    if (!isValidObject(item.action)) {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.INVALID_SCHEDULE_ACTION
      );
    }
  }
}
