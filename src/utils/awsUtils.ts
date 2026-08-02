/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoBase } from "../ESPRMNeoBase";
import { ESPRMNeoUser } from "../ESPRMNeoUser";
import { ESPRMNeoStorage } from "../services/ESPRMNeoStorage/ESPRMNeoStorage";
import { isTokenExpired as checkTokenExpiry } from "../services/ESPRMNeoHelpers/CheckTokenExpiry";
import { ESPAWSCredentials } from "../types/input";
import { stripTrailingSlash } from "./baseUtils";
import {
  APIPathV1,
  AWSCredentialsErrorMessages,
  StorageKeys,
  TokenErrorCodes,
} from "./constants";
import { ESPTokenError } from "./error/ESPTokenError";
import { Logger } from "./logger";

const logger = new Logger("awsUtils");

/** Wire-format response from POST /v1/user/credentials. */
export type TemporaryCredentialsApiResponse = {
  access_key_id?: string;
  secret_access_key?: string;
  session_token?: string;
  expiration?: number;
  message?: string;
  error?: string;
};

/**
 * Builds a full URL on the main RainMaker API gateway (not the User API).
 * /v1/user/credentials uses CognitoAuthorizer but lives on the main API.
 */
export function buildMainApiUrl(path: string): string {
  const baseUrl = stripTrailingSlash(ESPRMNeoBase.getConfig().baseUrl ?? "");
  const pathWithSlash = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${pathWithSlash}`;
}

/** URL for POST /v1/user/credentials. */
export function buildUserCredentialsUrl(): string {
  return buildMainApiUrl(APIPathV1.USER_CREDENTIALS);
}

/**
 * Extends the Cognito session using the stored refresh token.
 * @throws {ESPTokenError} When no refresh token is stored.
 */
export async function refreshUserSession(): Promise<void> {
  const refreshToken = await ESPRMNeoStorage.getItem(StorageKeys.REFRESHTOKEN);
  if (!refreshToken) {
    throw new ESPTokenError(TokenErrorCodes.MISSING_REFRESH_TOKEN);
  }
  await ESPRMNeoUser.extendSession(refreshToken);
}

/**
 * Ensures a non-expired ID token is available before calling the credentials API.
 * Refreshes the session when the stored ID token is expired or undecodable.
 * @throws {ESPTokenError} When the ID token is missing or session refresh fails.
 */
export async function ensureValidIdToken(): Promise<void> {
  const idToken = await ESPRMNeoStorage.getItem(StorageKeys.IDTOKEN);
  if (!idToken) {
    throw new ESPTokenError(TokenErrorCodes.MISSING_ID_TOKEN);
  }

  let needsRefresh = false;
  try {
    needsRefresh = checkTokenExpiry(idToken);
  } catch {
    needsRefresh = true;
  }

  if (!needsRefresh) {
    return;
  }

  logger.debug(AWSCredentialsErrorMessages.ID_TOKEN_REFRESH);
  await refreshUserSession();
}

/**
 * Best-effort error string from a credentials API response.
 */
export function parseCredentialsErrorMessage(
  response: Response,
  data: TemporaryCredentialsApiResponse | null,
  responseText: string
): string {
  const fromJson =
    (typeof data?.message === "string" && data.message.trim()) ||
    (typeof data?.error === "string" && data.error.trim());
  if (fromJson) {
    return fromJson;
  }
  const trimmed = responseText.trim();
  if (trimmed) {
    return trimmed;
  }
  return AWSCredentialsErrorMessages.HTTP_ERROR(response.status);
}

/** True when the credentials API rejected the request due to an expired token. */
export function isExpiredTokenAuthError(
  status: number,
  message: string
): boolean {
  return status === 401 && message.toLowerCase().includes("expired");
}

/**
 * Maps a credentials API payload to {@link ESPAWSCredentials}.
 * @throws {Error} When required credential fields are missing.
 */
export function extractTemporaryCredentials(
  data: TemporaryCredentialsApiResponse | null
): ESPAWSCredentials {
  if (
    !data?.access_key_id ||
    !data?.secret_access_key ||
    !data?.session_token
  ) {
    logger.error(AWSCredentialsErrorMessages.INCOMPLETE_CREDENTIALS_LOG, {
      hasAccessKey: !!data?.access_key_id,
      hasSecretKey: !!data?.secret_access_key,
      hasSessionToken: !!data?.session_token,
    });
    throw new Error(AWSCredentialsErrorMessages.INCOMPLETE_CREDENTIALS);
  }

  const expiration = data.expiration
    ? new Date(data.expiration * 1000).toISOString()
    : new Date(Date.now() + 3600000).toISOString();

  return {
    accessKey: data.access_key_id,
    secretKey: data.secret_access_key,
    sessionToken: data.session_token,
    expiration,
    ...(typeof data.message === "string" ? { message: data.message } : {}),
  };
}

/**
 * POSTs /v1/user/credentials with the access token as Bearer auth and the
 * ID token in the body. Both must come from the same sign-in.
 */
export async function postUserCredentials(url: string): Promise<{
  response: Response;
  data: TemporaryCredentialsApiResponse | null;
  responseText: string;
}> {
  const [accessToken, idToken] = await Promise.all([
    ESPRMNeoStorage.getItem(StorageKeys.ACCESSTOKEN),
    ESPRMNeoStorage.getItem(StorageKeys.IDTOKEN),
  ]);
  if (!accessToken) {
    logger.error(AWSCredentialsErrorMessages.MISSING_ACCESS_TOKEN);
    throw new ESPTokenError(TokenErrorCodes.MISSING_ACCESS_TOKEN);
  }
  if (!idToken) {
    logger.error(AWSCredentialsErrorMessages.MISSING_ID_TOKEN);
    throw new ESPTokenError(TokenErrorCodes.MISSING_ID_TOKEN);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ id_token: idToken }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(AWSCredentialsErrorMessages.NETWORK_ERROR(detail), error);
    throw new Error(AWSCredentialsErrorMessages.NETWORK_ERROR(detail));
  }

  let data: TemporaryCredentialsApiResponse | null = null;
  let responseText = "";
  try {
    responseText = await response.text();
    if (responseText) {
      try {
        data = JSON.parse(responseText) as TemporaryCredentialsApiResponse;
      } catch {
        // non-JSON body; parseCredentialsErrorMessage falls back to responseText
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(AWSCredentialsErrorMessages.READ_RESPONSE_FAILED(detail), error);
    throw new Error(AWSCredentialsErrorMessages.READ_RESPONSE_FAILED(detail));
  }

  return { response, data, responseText };
}
