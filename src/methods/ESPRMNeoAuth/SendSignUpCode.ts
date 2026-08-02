/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPAuthError, ESPRMNeoAuth } from "../../ESPRMNeoAuth";
import { ESPRMNeoAPIManager } from "../../services/ESPRMNeoAPIManager";
import { SignupRequest, SignupApiResponse } from "../../types/auth";
import { ESPAPIResponse } from "../../types/output";
import { Logger } from "../../utils/logger";
import { APIPathV1, AuthErrorCodes } from "../../utils/constants";
import { authErrorMessages } from "../../utils/error/errorMessages";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { signupIdentityFromUsername } from "../../utils/authUtils";

const logger = new Logger("SendSignUpCode");

/**
 * Builds the signup request body from username, password, and optional attributes.
 * Explicit `userAttributes` override the username-derived email / phone fields.
 */
function toSignupRequest(
  username: string,
  password: string,
  userAttributes?: Record<string, string>
): SignupRequest {
  const attrs = userAttributes ?? {};
  const identity = signupIdentityFromUsername(username);

  return {
    password,
    email: attrs.email ?? identity.email,
    phone_number: attrs.phone_number ?? identity.phone_number,
  };
}

/**
 * Augments the ESPRMNeoAuth class with the `sendSignUpCode` method.
 */
declare module "../../ESPRMNeoAuth" {
  interface ESPRMNeoAuth {
    /**
     * Sends a verification code to the user's email during the sign-up process.
     *
     * Calls `POST /v1/user/auth/signup`.
     *
     * @param username - The email address of the user signing up
     * @param password - The password for the new account
     * @param userAttributes - Optional additional user attributes
     * @returns A promise that resolves with the API response when the verification code is sent successfully
     * @throws {ESPAuthError} If the sign-up code request fails.
     */
    sendSignUpCode(
      username: string,
      password: string,
      userAttributes?: Record<string, string>
    ): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoAuth.prototype.sendSignUpCode = async function (
  username: string,
  password: string,
  userAttributes?: Record<string, string>
): Promise<ESPAPIResponse> {
  try {
    const requestBody = toSignupRequest(username, password, userAttributes);
    const api = ESPRMNeoAPIManager.getInstance();
    logger.debug(`sendSignUpCode → POST ${APIPathV1.USER_AUTH_SIGNUP}`);

    const apiResponse = await api.postUserApi<SignupApiResponse | null>(
      APIPathV1.USER_AUTH_SIGNUP,
      requestBody
    );
    return normalizeApiResponse(apiResponse);
  } catch (err) {
    if (err instanceof ESPAuthError) throw err;
    const message =
      err instanceof Error ? err.message : authErrorMessages.SIGNUP_FAILED;
    logger.debug("sendSignUpCode → Error:", message);
    throw new ESPAuthError(AuthErrorCodes.SIGNUP_FAILED, message, err);
  }
};
