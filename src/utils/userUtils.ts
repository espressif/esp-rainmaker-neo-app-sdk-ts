/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoStorage } from "../services/ESPRMNeoStorage/ESPRMNeoStorage";
import { ESPRMNeoAPIManager } from "../services/ESPRMNeoAPIManager";
import { APIPathV1, StorageKeys } from "./constants";
import { clearAllNcfgVersionMarkers } from "./nodeNcfgVersionHandler";
import { Logger } from "./logger";

const logger = new Logger("userUtils");

export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs an action without letting failures abort the caller. */
export async function failSafe(
  step: string,
  action: () => void | Promise<void>
): Promise<void> {
  try {
    await action();
    logger.debug(`${step} succeeded`);
  } catch (error) {
    logger.warn(`${step} failed`, { error: errorDetail(error) });
  }
}

/** Best-effort `POST /v1/user/auth/signout` when an access token is present. */
export async function invalidateServerSession(): Promise<void> {
  const accessToken =
    (await ESPRMNeoStorage.getItem(StorageKeys.ACCESSTOKEN)) || undefined;
  if (!accessToken) {
    logger.debug("Skipping server signout: no access token");
    return;
  }

  const refreshToken =
    (await ESPRMNeoStorage.getItem(StorageKeys.REFRESHTOKEN)) || undefined;
  const requestBody = refreshToken
    ? { refresh_token: refreshToken }
    : undefined;

  await ESPRMNeoAPIManager.getInstance().postUserApiWithBearer(
    APIPathV1.USER_AUTH_SIGNOUT,
    requestBody,
    accessToken
  );
}

/** Removes access, id, and refresh tokens from storage. */
export async function clearTokens(): Promise<void> {
  await ESPRMNeoStorage.removeItem(StorageKeys.ACCESSTOKEN);
  await ESPRMNeoStorage.removeItem(StorageKeys.IDTOKEN);
  await ESPRMNeoStorage.removeItem(StorageKeys.REFRESHTOKEN);
}

/**
 * Clears ncfg version markers and every cached node config they referenced.
 */
export async function clearNodeConfigCache(): Promise<void> {
  const trackedNodeIds = await clearAllNcfgVersionMarkers();
  await Promise.all(
    trackedNodeIds.map((nodeId) =>
      ESPRMNeoStorage.removeItem(StorageKeys.NODE_CONFIG_PREFIX + nodeId).catch(
        () => undefined
      )
    )
  );
}
