/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Base class for creating custom errors.
 */
export class ESPBaseError extends Error {
  code: string;
  label: string;

  constructor(
    label: string,
    code: string,
    errorMessages: Record<string, string>,
    defaultMessage: string
  ) {
    super(errorMessages[code] || defaultMessage);
    this.code = code;
    this.label = label;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
