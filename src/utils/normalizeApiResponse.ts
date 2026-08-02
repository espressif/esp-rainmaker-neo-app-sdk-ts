/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SuccessResponse } from "../types/output";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Normalizes API success payloads to {@link SuccessResponse}.
 * Expects `{ message }` from the backend or an empty body on success.
 */
export function normalizeApiResponse(
  response: unknown,
  fallback: SuccessResponse = {}
): SuccessResponse {
  const record = asRecord(response);
  if (!record) {
    return fallback;
  }

  if (typeof record.message === "string" && record.message.length > 0) {
    return { message: record.message };
  }

  return fallback;
}
