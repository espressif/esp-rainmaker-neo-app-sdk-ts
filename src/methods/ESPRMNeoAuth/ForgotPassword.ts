/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPAuthError, ESPRMNeoAuth } from "../../ESPRMNeoAuth";
import { APIPathV1, AuthErrorCodes } from "../../utils/constants";
import { authErrorMessages } from "../../utils/error/errorMessages";
import { ESPRMNeoAPIManager } from "../../services/ESPRMNeoAPIManager";
import {
  ForgotPasswordApiResponse,
  ForgotPasswordRequest,
} from "../../types/auth";
import { ForgotPasswordResponse } from "../../types/output";
import { Logger } from "../../utils/logger";

const logger = new Logger("ForgotPassword");

function toForgotPasswordResponse(
  apiResponse: ForgotPasswordApiResponse | null
): ForgotPasswordResponse {
  return {
    message: apiResponse?.message,
  };
}

/**
 * Augments the ESPRMNeoAuth class with the `forgotPassword` method.
 */
declare module "../../ESPRMNeoAuth" {
  interface ESPRMNeoAuth {
    /**
     * Initiates the password recovery process for a user.
     *
     * Calls `POST /v1/user/auth/password-recovery`.
     *
     * @param username - The username (email or phone number) for password recovery.
     * @returns The server response with an optional `message` field — the only
     *   field the backend returns (verified against the backend source).
     * @throws {ESPAuthError} If recovery initiation fails.
     */
    forgotPassword(username: string): Promise<ForgotPasswordResponse>;
  }
}

ESPRMNeoAuth.prototype.forgotPassword = async function (
  username: string
): Promise<ForgotPasswordResponse> {
  try {
    const requestBody: ForgotPasswordRequest = { username };
    const api = ESPRMNeoAPIManager.getInstance();
    logger.debug(
      `forgotPassword → POST ${APIPathV1.USER_AUTH_PASSWORD_RECOVERY}`
    );

    const apiResponse = await api.postUserApi<ForgotPasswordApiResponse | null>(
      APIPathV1.USER_AUTH_PASSWORD_RECOVERY,
      requestBody
    );

    return toForgotPasswordResponse(apiResponse);
  } catch (err) {
    if (err instanceof ESPAuthError) throw err;
    const message =
      err instanceof Error
        ? err.message
        : authErrorMessages.FORGOT_PASSWORD_FAILED;
    logger.debug("forgotPassword → Error:", message);
    throw new ESPAuthError(
      AuthErrorCodes.FORGOT_PASSWORD_FAILED,
      message,
      err
    );
  }
};
