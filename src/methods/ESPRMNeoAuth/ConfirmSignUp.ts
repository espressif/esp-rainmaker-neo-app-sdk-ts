/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPAuthError, ESPRMNeoAuth } from "../../ESPRMNeoAuth";
import {
  APIPathV1,
  AuthErrorCodes,
  AuthSuccessMessages,
} from "../../utils/constants";
import { ESPRMNeoAPIManager } from "../../services/ESPRMNeoAPIManager";
import { VerifySignupRequest, VerifySignupApiResponse } from "../../types/auth";
import { ConfirmSignUpResponse } from "../../types/output";
import { Logger } from "../../utils/logger";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { authErrorMessages } from "../../utils/error/errorMessages";
import { signupIdentityFromUsername } from "../../utils/authUtils";

const logger = new Logger("ConfirmSignUp");

/**
 * Augments the ESPRMNeoAuth class with the `confirmSignUp` method.
 */
declare module "../../ESPRMNeoAuth" {
  interface ESPRMNeoAuth {
    /**
     * Confirms a user's sign-up using the verification code sent by Cognito.
     *
     * Calls `POST /v1/user/auth/signup/verify`.
     *
     * @param username - The username (typically the user's email or phone).
     * @param verificationCode - The verification code received by the user.
     * @returns The API response.
     * @throws {ESPAuthError} If confirmation fails.
     */
    confirmSignUp(
      username: string,
      verificationCode: string
    ): Promise<ConfirmSignUpResponse>;
  }
}

ESPRMNeoAuth.prototype.confirmSignUp = async function (
  username: string,
  verificationCode: string
): Promise<ConfirmSignUpResponse> {
  try {
    const requestBody: VerifySignupRequest = {
      code: verificationCode,
      ...signupIdentityFromUsername(username),
    };

    const api = ESPRMNeoAPIManager.getInstance();
    logger.debug(
      `confirmSignUp → POST ${APIPathV1.USER_AUTH_SIGNUP_VERIFY}`
    );

    const apiResponse = await api.postUserApi<VerifySignupApiResponse | null>(
      APIPathV1.USER_AUTH_SIGNUP_VERIFY,
      requestBody
    );

    return normalizeApiResponse(apiResponse, {
      message: AuthSuccessMessages.USER_CONFIRMED,
    });
  } catch (err) {
    if (err instanceof ESPAuthError) throw err;
    const message =
      err instanceof Error
        ? err.message
        : authErrorMessages.CONFIRM_SIGNUP_FAILED;
    logger.debug("confirmSignUp → Error:", message);
    throw new ESPAuthError(
      AuthErrorCodes.CONFIRM_SIGNUP_FAILED,
      message,
      err
    );
  }
};
