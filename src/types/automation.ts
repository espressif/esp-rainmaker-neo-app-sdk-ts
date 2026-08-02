/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Action target for automation actions
 */
export interface ActionTarget {
  node: string;
  path: string;
  value: any;
}

/**
 * Automation conditions (references to trigger IDs)
 */
export interface AutomationConditions {
  and: string[]; // Array of trigger IDs
}

/**
 * Automation actions (targets to execute)
 */
export interface AutomationActions {
  targets: ActionTarget[];
}

/**
 * Automation enable/disable status as stored and returned by the backend.
 * `enabled` defaults to `"enabled"` when the field is absent (legacy items).
 */
export type AutomationStatus = "enabled" | "disabled";

/**
 * Fields the SDK accepts when creating or updating an automation.
 * `id` is omitted here because the server mints it on creation and it
 * cannot be changed later.
 */
export interface CreateAutomationInput {
  name: string; // Name of the automation
  conditions: AutomationConditions; // Conditions referencing trigger IDs
  actions: AutomationActions; // Actions to execute
  /** Enable/disable flag stored inside the payload. Defaults to "enabled" when absent. */
  status?: AutomationStatus;
  retrigger?: boolean; // Whether automation can retrigger
}

/**
 * A fully-formed automation as returned by the server or held on an
 * `ESPRMNeoAutomation` instance. Always has an id.
 */
export interface AutomationItem extends CreateAutomationInput {
  id: string;
}

/** Response shape for create automation API (snake_case from backend). */
export interface CreateAutomationApiResponse {
  automation_id: string;
  group_id: string;
  message?: string;
}

/**
 * Raw response shape for get automation / get automations API.
 * Backend returns a flat object: {id, name, conditions, actions, ...} with no payload wrapper.
 */
export interface GetAutomationApiResponse {
  id: string;
  name: string;
  conditions: AutomationConditions;
  actions: AutomationActions;
  enabled?: boolean;
  retrigger?: boolean;
}

