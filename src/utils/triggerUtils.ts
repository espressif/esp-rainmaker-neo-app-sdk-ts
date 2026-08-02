/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../ESPRMNeoNode";
import { TriggerItem, TriggerOperator } from "../types/trigger";

/**
 * Converts a trigger-like object to TriggerItem (for building payloads).
 */
export function triggerToItem(t: {
  id: string;
  type: string;
  enabled?: boolean;
  path: string;
  operator: TriggerOperator;
  value: unknown;
}): TriggerItem {
  return {
    id: t.id,
    type: t.type,
    enabled: t.enabled,
    path: t.path,
    operator: t.operator,
    value: t.value,
  };
}

/**
 * Fetches the current trigger list for a node as TriggerItem[].
 * Always hits the cloud — the triggers API is replace-all.
 */
export async function getTriggerItemsForNode(
  node: ESPRMNeoNode
): Promise<TriggerItem[]> {
  const triggers = await node.getTriggers();
  return triggers.map((t) => triggerToItem(t));
}

/**
 * Merges defined update fields onto a base TriggerItem without writing
 * `undefined` over existing values.
 */
export function mergeTriggerItem(
  base: TriggerItem,
  updates: Partial<TriggerItem>
): TriggerItem {
  return {
    ...base,
    ...(updates.path !== undefined ? { path: updates.path } : {}),
    ...(updates.enabled !== undefined ? { enabled: updates.enabled } : {}),
    ...(updates.operator !== undefined ? { operator: updates.operator } : {}),
    ...(updates.value !== undefined ? { value: updates.value } : {}),
  };
}

/**
 * Copies defined update fields onto a live trigger instance.
 */
export function applyTriggerUpdates(
  target: {
    path: string;
    enabled?: boolean;
    operator: TriggerOperator;
    value: unknown;
  },
  updates: Partial<TriggerItem>
): void {
  if (updates.path !== undefined) target.path = updates.path;
  if (updates.enabled !== undefined) target.enabled = updates.enabled;
  if (updates.operator !== undefined) target.operator = updates.operator;
  if (updates.value !== undefined) target.value = updates.value;
}
