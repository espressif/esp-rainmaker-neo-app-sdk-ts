/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AutomationItem,
  AutomationConditions,
  AutomationActions,
  AutomationStatus,
} from "./types/automation";
import { ESPRMNeoGroup } from "./ESPRMNeoGroup";
import {
  APICallValidationErrorCodes,
  AutomationStatusValues,
} from "./utils/constants";
import { ESPAPICallValidationError } from "./utils/error/ESPAPICallValidationError";

/**
 * Represents an automation in the ESP Rainmaker Neo SDK.
 * Provides instance methods for automation operations.
 */
export class ESPRMNeoAutomation {
  id: string;
  groupId: string;
  name: string;
  conditions: AutomationConditions;
  actions: AutomationActions;
  /** Enable/disable flag. Defaults to "enabled" when absent (backend default). */
  status?: AutomationStatus;
  retrigger?: boolean;

  constructor(data: AutomationItem, group: ESPRMNeoGroup) {
    if (!data.id) {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.MISSING_AUTOMATION_ID
      );
    }
    if (!data.name) {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.MISSING_AUTOMATION_NAME
      );
    }
    if (!data.conditions) {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.MISSING_AUTOMATION_CONDITIONS
      );
    }
    if (!data.actions) {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.MISSING_AUTOMATION_ACTIONS
      );
    }

    this.id = data.id;
    this.groupId = group.groupId;
    this.name = data.name;
    this.conditions = data.conditions;
    this.actions = data.actions;
    this.status = data.status ?? AutomationStatusValues.ENABLED;
    this.retrigger = data.retrigger;
  }
}
