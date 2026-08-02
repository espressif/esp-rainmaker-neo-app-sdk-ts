/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPAuthError, ESPRMNeoAuth } from "../../ESPRMNeoAuth";
import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { UserTokensData } from "../../types/input";
import { ESPRMNeoStorage } from "../../services/ESPRMNeoStorage/ESPRMNeoStorage";
import { isTokenExpired } from "../../services/ESPRMNeoHelpers/CheckTokenExpiry";
import { StorageKeys, AuthErrorCodes } from "../../utils/constants";
import { authErrorMessages } from "../../utils/error/errorMessages";
import { Logger } from "../../utils/logger";

const logger = new Logger("GetLoggedInUser");

/**
 * Loads access, id, and refresh tokens from storage in one round-trip.
 * @returns Tokens if all three exist, otherwise null.
 */
async function getStoredTokens(): Promise<UserTokensData | null> {
  const [accessToken, idToken, refreshToken] = await Promise.all([
    ESPRMNeoStorage.getItem(StorageKeys.ACCESSTOKEN),
    ESPRMNeoStorage.getItem(StorageKeys.IDTOKEN),
    ESPRMNeoStorage.getItem(StorageKeys.REFRESHTOKEN),
  ]);
  if (!accessToken || !idToken || !refreshToken) return null;
  return { accessToken, idToken, refreshToken };
}

/**
 * Augments the ESPRMNeoAuth class with the `getLoggedInUser` method.
 */
declare module "../../ESPRMNeoAuth" {
  interface ESPRMNeoAuth {
    /**
     * Retrieves the currently logged-in user.
     *
     * Reads tokens from storage. If the access token is expired, refreshes
     * the session using the refresh token, then reloads. Returns null when
     * no tokens are stored.
     *
     * @returns {Promise<ESPRMNeoUser | null>} An ESPRMNeoUser if a session is active, or null when no tokens are stored.
     * @throws {ESPAuthError} If the session refresh fails.
     */
    getLoggedInUser(): Promise<ESPRMNeoUser | null>;
  }
}

ESPRMNeoAuth.prototype.getLoggedInUser =
  async function (): Promise<ESPRMNeoUser | null> {
    try {
      let tokens = await getStoredTokens();
      if (!tokens) return null;

      if (isTokenExpired(tokens.accessToken)) {
        await ESPRMNeoUser.extendSession(tokens.refreshToken);
        tokens = await getStoredTokens();
        if (!tokens) return null;
      }

      return new ESPRMNeoUser(tokens);
    } catch (err) {
      if (err instanceof ESPAuthError) throw err;
      const message =
        err instanceof Error
          ? err.message
          : authErrorMessages.GET_LOGGED_IN_USER_FAILED;
      logger.debug("getLoggedInUser → Error:", message);
      throw new ESPAuthError(
        AuthErrorCodes.GET_LOGGED_IN_USER_FAILED,
        message,
        err
      );
    }
  };
