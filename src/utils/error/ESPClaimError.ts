/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorLabels } from "../constants";
import { claimErrorMessages, defaultErrorMessages } from "./errorMessages";
import { ESPBaseError } from "./ESPBaseError";

/**
 * Represents an error related to assisted claiming.
 *
 * This class extends `ESPBaseError` and is used to handle errors that occur
 * during assisted claiming, such as device-side CSR retrieval or claiming
 * API failures.
 *
 * @extends ESPBaseError
 */
export class ESPClaimError extends ESPBaseError {
  /**
   * Creates an instance of `ESPClaimError`.
   *
   * @param code - The error code corresponding to a specific claiming error message
   *               from `claimErrorMessages`.
   * @param detail - Optional reason from the claiming service, appended to the
   *                 message. The claiming API returns `{ message }` on every
   *                 failure, and those reasons are actionable — a node quota
   *                 cap, an unclaimed device, a rejected CSR — so they are
   *                 surfaced instead of a generic API failure.
   */
  constructor(code: keyof typeof claimErrorMessages, detail?: string) {
    super(
      ErrorLabels.ESPClaimError,
      code,
      claimErrorMessages,
      defaultErrorMessages.CLAIM_ERROR
    );
    const reason = detail?.trim();
    if (reason) {
      this.message = `${this.message} (${reason})`;
    }
  }
}
