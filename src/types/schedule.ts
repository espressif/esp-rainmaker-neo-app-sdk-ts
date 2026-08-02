/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Schedule trigger definition (minutes/day/month/year or relative seconds)
 */
export interface ScheduleTrigger {
  m?: number; // minutes since midnight
  d?: number; // day-of-week bitmask
  dd?: number; // day of month
  mm?: number; // month bitmask
  yy?: number; // year
  rsec?: number; // relative seconds from now
}

/**
 * Action map: device -> param -> value
 */
export type ScheduleActionMap = Record<string, Record<string, any>>;

/**
 * Single schedule item (aligns with Swagger
 * /v1/groups/{groupId}/nodes/{nodeId}/schedules)
 */
export interface ScheduleItem {
  id?: string;
  name?: string;
  enabled: boolean;
  triggers: ScheduleTrigger[];
  action: ScheduleActionMap;
  validity?: { start?: number; end?: number };
}

/**
 * Node schedule envelope used by backend
 */
export interface NodeSchedulePayload {
  schedule: { schedules: ScheduleItem[] };
}

/**
 * Generic status response from backend for write operations
 */
export interface StatusResponse {
  status?: string;
  [k: string]: any;
}
