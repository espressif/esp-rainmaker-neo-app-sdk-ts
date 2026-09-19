/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { StorageKeys, TokenErrorCodes } from "./utils/constants";
import { UserTokensData } from "./types/input";
import type { EventCallbacks } from "./types/discovery";
import { ESPRMNeoStorage } from "./services/ESPRMNeoStorage/ESPRMNeoStorage";
import { isTokenExpired } from "./services/ESPRMNeoHelpers/CheckTokenExpiry";
import { ESPRMNeoAuth } from "./ESPRMNeoAuth";
import { ESPTokenError } from "./utils/error/ESPTokenError";
import { tokenErrorMessages } from "./utils/error/errorMessages";
import { Logger } from "./utils/logger";

const logger = new Logger("ESPRMNeoUser");

/**
 * Represents an authenticated user in the ESP Rainmaker Neo system.
 * Provides methods for user operations, device management, group management,
 * and MQTT-based real-time communication.
 *
 */
export class ESPRMNeoUser {
  /** Registered event subscriber callbacks, keyed by event (see {@link subscribe}). */
  eventCallbacks: EventCallbacks = {};

  /**
   * Per-event teardown handles for backing sources started by {@link subscribe}
   * (LAN discovery, node-updates bus, custom discovery). Kept so
   * {@link unsubscribe} / {@link removeAllCallbacks} can stop them.
   */
  eventTeardowns: Record<string, { stop(): void }> = {};

  /**
   * Shared in-flight session refresh so concurrent getAccessToken/getIdToken
   * calls after expiry only hit the refresh API once.
   */
  private static sessionRefreshPromise: Promise<void> | null = null;

  /**
   * Initializes the ESPRMNeoUser instance and persists the tokens to storage.
   *
   * @param tokens - Object containing the access token, id token, and refresh token.
   */
  constructor(tokens: UserTokensData) {
    ESPRMNeoStorage.setItem(StorageKeys.ACCESSTOKEN, tokens.accessToken);
    ESPRMNeoStorage.setItem(StorageKeys.IDTOKEN, tokens.idToken);
    ESPRMNeoStorage.setItem(StorageKeys.REFRESHTOKEN, tokens.refreshToken);

    logger.debug("User initialized");
  }

  /** Reads a token from storage, throwing when the user is not logged in. */
  private static async requireToken(
    storageKey: string,
    missingCode: keyof typeof tokenErrorMessages
  ): Promise<string> {
    const token = await ESPRMNeoStorage.getItem(storageKey);
    if (!token) {
      throw new ESPTokenError(missingCode);
    }
    return token;
  }

  /** True when the JWT is expired or cannot be decoded. */
  private static needsRefresh(token: string): boolean {
    try {
      return isTokenExpired(token);
    } catch {
      return true;
    }
  }

  /**
   * Refreshes Cognito tokens via the stored refresh token.
   * Concurrent callers share one in-flight refresh.
   */
  private static async refreshSession(): Promise<void> {
    if (ESPRMNeoUser.sessionRefreshPromise) {
      return ESPRMNeoUser.sessionRefreshPromise;
    }

    ESPRMNeoUser.sessionRefreshPromise = (async () => {
      const refreshToken = await ESPRMNeoUser.requireToken(
        StorageKeys.REFRESHTOKEN,
        TokenErrorCodes.MISSING_REFRESH_TOKEN
      );
      try {
        await ESPRMNeoUser.extendSession(refreshToken);
      } catch {
        throw new ESPTokenError(TokenErrorCodes.EXTEND_SESSION_FAILED);
      }
    })().finally(() => {
      ESPRMNeoUser.sessionRefreshPromise = null;
    });

    return ESPRMNeoUser.sessionRefreshPromise;
  }

  /**
   * Returns a stored access/id token, refreshing the session first when expired.
   * Mirrors classic RainMaker `ESPRMUser.getAccessToken()` mid-session refresh.
   */
  private static async getValidToken(
    storageKey: string,
    missingCode: keyof typeof tokenErrorMessages
  ): Promise<string> {
    const token = await ESPRMNeoUser.requireToken(storageKey, missingCode);
    if (!ESPRMNeoUser.needsRefresh(token)) {
      return token;
    }

    logger.debug("Token expired; refreshing session");
    await ESPRMNeoUser.refreshSession();
    return ESPRMNeoUser.requireToken(storageKey, missingCode);
  }

  /**
   * Returns a valid Cognito access token from storage.
   * Refreshes the session when the stored access token is expired.
   *
   * @throws {ESPTokenError} When no access/refresh token is stored, or refresh fails.
   */
  public async getAccessToken(): Promise<string> {
    return ESPRMNeoUser.getValidToken(
      StorageKeys.ACCESSTOKEN,
      TokenErrorCodes.MISSING_ACCESS_TOKEN
    );
  }

  /**
   * Returns a valid Cognito ID token from storage.
   * Refreshes the session when the stored ID token is expired.
   *
   * @throws {ESPTokenError} When no ID/refresh token is stored, or refresh fails.
   */
  public async getIdToken(): Promise<string> {
    return ESPRMNeoUser.getValidToken(
      StorageKeys.IDTOKEN,
      TokenErrorCodes.MISSING_ID_TOKEN
    );
  }

  /**
   * Returns the current Cognito refresh token from storage.
   * @throws {ESPTokenError} When no refresh token is stored (not logged in).
   */
  public async getRefreshToken(): Promise<string> {
    return ESPRMNeoUser.requireToken(
      StorageKeys.REFRESHTOKEN,
      TokenErrorCodes.MISSING_REFRESH_TOKEN
    );
  }

  /**
   * Extends the current session using a refresh token.
   */
  public static async extendSession(refreshToken: string): Promise<void> {
    const response = await ESPRMNeoAuth.getRefreshedTokens(refreshToken);
    await ESPRMNeoStorage.setItem(StorageKeys.ACCESSTOKEN, response.accessToken);
    await ESPRMNeoStorage.setItem(StorageKeys.IDTOKEN, response.idToken);
    await ESPRMNeoStorage.setItem(
      StorageKeys.REFRESHTOKEN,
      response.refreshToken
    );
  }
}
