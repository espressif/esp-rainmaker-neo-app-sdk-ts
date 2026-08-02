/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPRMNeoStorage } from "../../services/ESPRMNeoStorage/ESPRMNeoStorage";
import { ESPAWSCredentials } from "../../types/input";
import {
  buildUserCredentialsUrl,
  ensureValidIdToken,
  extractTemporaryCredentials,
  isExpiredTokenAuthError,
  parseCredentialsErrorMessage,
  postUserCredentials,
  refreshUserSession,
} from "../../utils/awsUtils";
import { AWSCredentialsErrorMessages } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("GetTemporaryAWSCredentials");

const MAX_CREDENTIAL_RETRIES = 2;

/** @deprecated Prefer {@link ESPAWSCredentials}; kept for existing call sites. */
export type TemporaryCredentialsResult = ESPAWSCredentials;

/**
 * Fetches temporary AWS credentials from `POST /v1/user/credentials`.
 *
 * Shared by {@link ESPRMNeoUser.getTemporaryAWSCredentials} and callers that
 * need identity-pool credentials (e.g. AssumeRole / MQTT setup) without
 * depending on prototype attachment order.
 *
 * Flow:
 * 1. Ensure a non-expired Cognito ID token (refresh session if needed).
 * 2. POST credentials with Bearer ID token.
 * 3. On 401 expired-token, refresh the session and retry (up to
 *    `MAX_CREDENTIAL_RETRIES` times).
 * 4. Persist and return the temporary credentials.
 *
 * @returns Temporary AWS credentials (access key, secret key, session token, expiration).
 * @throws {ESPTokenError} If the user is not logged in (missing ID/refresh token).
 * @throws {Error} On network failure, incomplete response, or non-retryable API error.
 */
export async function fetchTemporaryAWSCredentials(): Promise<ESPAWSCredentials> {
  logger.debug(AWSCredentialsErrorMessages.FETCH_CALLED);

  const url = buildUserCredentialsUrl();
  // Step 1: refresh a locally expired/undecodable ID token before the first request.
  await ensureValidIdToken();

  // Step 2–3: POST credentials; on 401 expired-token, refresh session and retry.
  for (let attempt = 0; attempt <= MAX_CREDENTIAL_RETRIES; attempt++) {
    const { response, data, responseText } = await postUserCredentials(url);

    if (response.ok) {
      // Step 4: map wire fields → ESPAWSCredentials, persist, then return.
      const credentials = extractTemporaryCredentials(data);
      await ESPRMNeoStorage.saveTemporaryCredentials(credentials);
      logger.debug(AWSCredentialsErrorMessages.FETCH_SUCCESS, {
        expiration: credentials.expiration,
        attempt: attempt + 1,
      });
      return credentials;
    }

    const errorMessage = parseCredentialsErrorMessage(
      response,
      data,
      responseText
    );
    // Retry only for 401 + "expired" in the message; other failures are terminal.
    const canRetry =
      attempt < MAX_CREDENTIAL_RETRIES &&
      isExpiredTokenAuthError(response.status, errorMessage);

    if (!canRetry) {
      logger.error(AWSCredentialsErrorMessages.API_ERROR, {
        status: response.status,
        message: errorMessage,
        attempt: attempt + 1,
      });
      throw new Error(errorMessage);
    }

    logger.debug(
      AWSCredentialsErrorMessages.CREDENTIALS_RETRY(
        attempt + 1,
        MAX_CREDENTIAL_RETRIES
      )
    );
    // Refresh Cognito session so the next attempt uses a fresh ID token.
    await refreshUserSession();
  }

  // Defensive: the loop always returns on success or throws on failure.
  throw new Error(AWSCredentialsErrorMessages.API_ERROR);
}

/**
 * Augments the ESPRMNeoUser class with the `getTemporaryAWSCredentials` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Gets temporary AWS credentials for the authenticated user.
     *
     * Calls `POST /v1/user/credentials` with the Cognito ID token as Bearer auth.
     * Refreshes the session (refresh token → new tokens) when the ID token is
     * expired locally, or when the API returns 401 with an expired-token
     * message, then retries. Delegates to {@link fetchTemporaryAWSCredentials}.
     *
     * @returns Temporary AWS credentials (access key, secret key, session token, expiration).
     * @throws {ESPTokenError} If the user is not logged in (missing ID/refresh token).
     * @throws {Error} If a network error occurs or the API request fails.
     */
    getTemporaryAWSCredentials(): Promise<ESPAWSCredentials>;
  }
}

/**
 * Implementation of `getTemporaryAWSCredentials` for {@link ESPRMNeoUser}.
 */
ESPRMNeoUser.prototype.getTemporaryAWSCredentials = async function () {
  return fetchTemporaryAWSCredentials();
};
