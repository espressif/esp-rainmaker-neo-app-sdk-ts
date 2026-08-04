/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Trigger comparison operator, matching the wire format expected by the
 * RainMaker firmware trigger codec (`eq`/`ne`/`gt`/`lt`/`ge`/`le`). The cloud
 * stores triggers verbatim, so any other spelling (e.g. `"=="`) reaches the
 * device unchanged and makes it reject the node's entire trigger list.
 */
export type TriggerOperator = "eq" | "ne" | "gt" | "lt" | "ge" | "le";

/**
 * Single trigger item.
 */
export interface TriggerItem {
  /** Server-visible id (must be unique within the node's trigger list). */
  id: string;
  /** Trigger source category (e.g. `"param"` for a device param trigger). */
  type: string;
  /** Dotted path locating the value to watch, e.g. `"Light.Power"`. */
  path: string;
  /** Comparison operator applied to `path`'s current value against `value`. */
  operator: TriggerOperator;
  /** Right-hand side of the comparison. */
  value: unknown;
  /** Whether the trigger is armed. Defaults to `true` on the server when absent. */
  enabled?: boolean;
}
