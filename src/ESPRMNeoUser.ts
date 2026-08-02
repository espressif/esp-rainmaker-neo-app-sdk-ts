/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { StorageKeys, TokenErrorCodes } from "./utils/constants";
import { UserTokensData } from "./types/input";
import type { EventCallbacks } from "./types/discovery";
import { ESPRMNeoStorage } from "./services/ESPRMNeoStorage/ESPRMNeoStorage";
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

  /**
   * Returns the current Cognito access token from storage.
   * @throws {ESPTokenError} When no access token is stored (not logged in).
   */
  public async getAccessToken(): Promise<string> {
    return ESPRMNeoUser.requireToken(
      StorageKeys.ACCESSTOKEN,
      TokenErrorCodes.MISSING_ACCESS_TOKEN
    );
  }

  /**
   * Returns the current Cognito ID token from storage.
   * @throws {ESPTokenError} When no ID token is stored (not logged in).
   */
  public async getIdToken(): Promise<string> {
    return ESPRMNeoUser.requireToken(
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
