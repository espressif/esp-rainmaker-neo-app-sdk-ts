/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Coerces a raw value to a finite number, or `undefined` if it cannot be
 * parsed (wrong type, NaN, ±Infinity).
 *
 * Accepts both `number` and `string` inputs; all other types return `undefined`.
 */
export function coerceToFiniteNumber(raw: unknown): number | undefined {
  if (typeof raw !== "number" && typeof raw !== "string") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Coerces a raw value to a non-empty string, or `undefined` if the value is
 * not a string or is an empty string.
 */
export function coerceToNonEmptyString(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

/**
 * Coerces a raw value to a trimmed non-empty string.
 * - `string` → trimmed; empty after trim → `undefined`
 * - finite `number` → decimal string (legacy firmware timestamps)
 * - all other types → `undefined`
 */
export function coerceToString(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const s = raw.trim();
    return s || undefined;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return undefined;
}
