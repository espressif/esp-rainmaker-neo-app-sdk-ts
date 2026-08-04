/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/** True if `value` is a member of the given enum. */
export function isEnumValue(value: unknown, enumObj: Record<string, unknown>): boolean {
    return Object.values(enumObj).includes(value as never);
}

/** True if `obj` has no own enumerable keys. */
export function isEmptyObject(obj?: Record<string, unknown>): boolean {
    return !obj || Object.keys(obj).length === 0;
}

/**
 * Coerces `value` to an object. Non-objects become `{}`.
 */
export function asObject<
  T extends Record<string, unknown> = Record<string, unknown>
>(value: unknown): T {
  return (typeof value === "object" && value !== null ? value : {}) as T;
}

/**
 * Normalizes an optional string or string array into a new `string[]`.
 * - `string[]` → shallow copy
 * - non-empty `string` → single-element array
 * - `undefined` / empty string → `[]`
 */
export function asStringArray(value?: string | string[]): string[] {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (value) {
    return [value];
  }
  return [];
}
