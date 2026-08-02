/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SDK-specific authentication error wrapper.
 *
 * Provides stable error codes so callers can branch on `err.code` while
 * preserving the original cause via `originalError` for debugging.
 */
export class ESPAuthError extends Error {
  public code: string;
  public originalError?: unknown;

  constructor(code: string, message: string, originalError?: unknown) {
    super(message);
    this.name = "ESPAuthError";
    this.code = code;
    this.originalError = originalError;
  }
}
