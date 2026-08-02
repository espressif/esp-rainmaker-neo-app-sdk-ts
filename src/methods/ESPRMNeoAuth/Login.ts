/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPAuthError, ESPRMNeoAuth } from "../../ESPRMNeoAuth";
import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPRMNeoAPIManager } from "../../services/ESPRMNeoAPIManager";
import { SigninRequest, SigninApiResponse } from "../../types/auth";
import { UserTokensData } from "../../types/input";
import { Logger } from "../../utils/logger";
import { APIPathV1, AuthErrorCodes } from "../../utils/constants";
import { authErrorMessages } from "../../utils/error/errorMessages";

const logger = new Logger("Login");

/**
 * Maps a sign-in API response to SDK token fields, or throws when any token is missing.
 */
function toUserTokens(apiResponse: SigninApiResponse | null): UserTokensData {
  if (
    !apiResponse?.access_token ||
    !apiResponse?.id_token ||
    !apiResponse?.refresh_token
  ) {
    logger.debug("login → Missing required tokens in response");
    throw new ESPAuthError(
      AuthErrorCodes.LOGIN_FAILED_MISSING_TOKENS,
      authErrorMessages.LOGIN_FAILED_MISSING_TOKENS,
      apiResponse
    );
  }

  return {
    accessToken: apiResponse.access_token,
    idToken: apiResponse.id_token,
    refreshToken: apiResponse.refresh_token,
  };
}

/**
 * Augments the ESPRMNeoAuth class with the `login` method.
 */
declare module "../../ESPRMNeoAuth" {
  interface ESPRMNeoAuth {
    /**
     * Logs in a user with username and password.
     *
     * Calls `POST /v1/user/auth/token`.
     *
     * @param username - The username (email or phone number) for authentication.
     * @param password - The user's password.
     * @returns A promise that resolves to an ESPRMNeoUser instance on successful login.
     * @throws {ESPAuthError} If authentication fails or credentials are invalid.
     */
    login(username: string, password: string): Promise<ESPRMNeoUser>;
  }
}

ESPRMNeoAuth.prototype.login = async function (
  username: string,
  password: string
): Promise<ESPRMNeoUser> {
  try {
    const api = ESPRMNeoAPIManager.getInstance();
    logger.debug(`login → POST ${APIPathV1.USER_AUTH_TOKEN}`);

    const requestBody: SigninRequest = { username, password };
    const apiResponse = await api.postUserApi<SigninApiResponse | null>(
      APIPathV1.USER_AUTH_TOKEN,
      requestBody
    );

    return new ESPRMNeoUser(toUserTokens(apiResponse));

  } catch (err) {
    if (err instanceof ESPAuthError) throw err;
    const message =
      err instanceof Error ? err.message : authErrorMessages.LOGIN_FAILED;
    logger.debug("login → Error:", message);
    throw new ESPAuthError(AuthErrorCodes.LOGIN_FAILED, message, err);
  }
};
