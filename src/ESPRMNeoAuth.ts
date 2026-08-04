/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoAPIManager } from "./services/ESPRMNeoAPIManager";
import { ESPRMNeoBaseConfig, UserTokensData } from "./types/input";
import { TokenRefreshApiResponse, TokenRefreshRequest } from "./types/auth";
import { Logger } from "./utils/logger";
import { APIPathV1, AuthErrorCodes } from "./utils/constants";
import { authErrorMessages } from "./utils/error/errorMessages";
import { ESPAuthError } from "./utils/error/ESPAuthError";

const logger = new Logger("ESPRMNeoAuth");

// Error class lives under utils/error. Re-exported here so existing callers
// `import { ESPAuthError } from "./ESPRMNeoAuth"` keep working.
export { ESPAuthError } from "./utils/error/ESPAuthError";

/**
 * The `ESPRMNeoAuth` class provides authentication functionality via the
 * RainMaker User Auth API. Key features include:
 *
 * - **Sign-Up Process**: Methods to send sign-up codes and confirm user registration.
 * - **Password Management**: Support for password recovery, setting new passwords, and login with credentials.
 * - **Session Management**: Provides functionality to fetch details of the currently logged-in user.
 */
export class ESPRMNeoAuth {
  private _config: ESPRMNeoBaseConfig;

  constructor(config: ESPRMNeoBaseConfig) {
    this._config = config;
  }

  /**
   * Returns the SDK config this auth instance was constructed with.
   * Prefer this over {@link ESPRMNeoBase.getConfig} in auth method implementations.
   */
  public getConfig(): Readonly<ESPRMNeoBaseConfig> {
    return this._config;
  }

  /**
   * Gets refreshed tokens using a refresh token without persisting them.
   *
   * Calls `POST /v1/user/auth/token/refresh` (unauthenticated; the backend
   * validates `refresh_token` in the body only).
   */
  public static async getRefreshedTokens(
    refreshToken: string
  ): Promise<UserTokensData> {
    const api = ESPRMNeoAPIManager.getInstance();
    logger.debug("getRefreshedTokens (token/refresh)", {
      refresh_token: refreshToken.substring(0, 20) + "...",
    });

    const requestBody: TokenRefreshRequest = { refresh_token: refreshToken };
    const apiResponse = await api.postUserApi<TokenRefreshApiResponse | null>(
      APIPathV1.USER_AUTH_TOKEN_REFRESH,
      requestBody
    );

    if (!apiResponse?.access_token || !apiResponse?.id_token) {
      throw new ESPAuthError(
        AuthErrorCodes.TOKEN_REFRESH_FAILED_MISSING_TOKENS,
        authErrorMessages.TOKEN_REFRESH_FAILED_MISSING_TOKENS,
        apiResponse
      );
    }

    return {
      accessToken: apiResponse.access_token,
      idToken: apiResponse.id_token,
      refreshToken,
    };
  }
}
