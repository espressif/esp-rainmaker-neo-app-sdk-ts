/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPAuthError, ESPRMNeoAuth } from "../../ESPRMNeoAuth";
import { ESPRMNeoAPIManager } from "../../services/ESPRMNeoAPIManager";
import {
  APIPathV1,
  AuthErrorCodes,
  AuthSuccessMessages,
} from "../../utils/constants";
import {
  PasswordRecoveryConfirmationRequest,
  PasswordRecoveryConfirmationApiResponse,
} from "../../types/auth";
import { SetNewPasswordResponse } from "../../types/output";
import { Logger } from "../../utils/logger";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { authErrorMessages } from "../../utils/error/errorMessages";

const logger = new Logger("SetNewPassword");

/**
 * Augments the ESPRMNeoAuth class with the `setNewPassword` method.
 */
declare module "../../ESPRMNeoAuth" {
  interface ESPRMNeoAuth {
    /**
     * Sets a new password for a user during password recovery flow.
     *
     * Calls `POST /v1/user/auth/password-recovery/confirmation`.
     *
     * @param username - The username (email or phone number) for password recovery.
     * @param newPassword - The new password to set.
     * @param verificationCode - The verification code received by the user.
     * @returns A promise that resolves to a SetNewPasswordResponse on success.
     * @throws {ESPAuthError} If the verification code is invalid or password setting fails.
     */
    setNewPassword(
      username: string,
      newPassword: string,
      verificationCode: string
    ): Promise<SetNewPasswordResponse>;
  }
}

ESPRMNeoAuth.prototype.setNewPassword = async function (
  username: string,
  newPassword: string,
  verificationCode: string
): Promise<SetNewPasswordResponse> {
  try {
    const requestBody: PasswordRecoveryConfirmationRequest = {
      username,
      code: verificationCode,
      new_password: newPassword,
    };

    const api = ESPRMNeoAPIManager.getInstance();
    logger.debug(
      `setNewPassword → POST ${APIPathV1.USER_AUTH_PASSWORD_RECOVERY_CONFIRMATION}`
    );

    const apiResponse =
      await api.postUserApi<PasswordRecoveryConfirmationApiResponse | null>(
        APIPathV1.USER_AUTH_PASSWORD_RECOVERY_CONFIRMATION,
        requestBody
      );

    return normalizeApiResponse(apiResponse, {
      message: AuthSuccessMessages.PASSWORD_RESET,
    });
  } catch (err) {
    if (err instanceof ESPAuthError) throw err;
    const message =
      err instanceof Error
        ? err.message
        : authErrorMessages.PASSWORD_RESET_FAILED;
    logger.debug("setNewPassword → Error:", message);
    throw new ESPAuthError(
      AuthErrorCodes.PASSWORD_RESET_FAILED,
      message,
      err
    );
  }
};
