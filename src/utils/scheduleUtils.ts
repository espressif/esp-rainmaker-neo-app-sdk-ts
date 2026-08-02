/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../ESPRMNeoNode";
import { ESPRMNeoSchedule } from "../ESPRMNeoSchedule";
import { ScheduleItem } from "../types/schedule";

/**
 * Fetches the current schedule list for a node as ScheduleItem[].
 * Always hits the cloud — the schedules API is replace-all and has no
 * version marker, so the SDK does not cache to avoid silent overwrites
 * when another session edits the same list.
 */
export async function getScheduleItemsForNode(
  node: ESPRMNeoNode
): Promise<ScheduleItem[]> {
  const schedules = await node.getSchedules();
  return schedules.map((s) => ({
    id: s.id,
    name: s.name,
    enabled: s.enabled,
    triggers: s.triggers,
    action: s.action,
    validity: s.validity,
  }));
}

/**
 * Converts an ESPRMNeoSchedule instance to ScheduleItem (for building payloads).
 */
export function scheduleToItem(s: ESPRMNeoSchedule): ScheduleItem {
  return {
    id: s.id,
    name: s.name,
    enabled: s.enabled,
    triggers: s.triggers,
    action: s.action,
    validity: s.validity,
  };
}
