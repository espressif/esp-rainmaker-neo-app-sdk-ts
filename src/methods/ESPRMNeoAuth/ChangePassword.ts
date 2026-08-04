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
  StorageKeys,
} from "../../utils/constants";
import { authErrorMessages } from "../../utils/error/errorMessages";
import { ESPRMNeoAPIManager } from "../../services/ESPRMNeoAPIManager";
import { ESPRMNeoStorage } from "../../services/ESPRMNeoStorage/ESPRMNeoStorage";
import { ChangePasswordRequest, ChangePasswordApiResponse } from "../../types/auth";
import { ChangePasswordResponse } from "../../types/output";
import { Logger } from "../../utils/logger";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

const logger = new Logger("ChangePassword");

/**
 * Augments the ESPRMNeoAuth class with the `changePassword` method.
 */
declare module "../../ESPRMNeoAuth" {
  interface ESPRMNeoAuth {
    /**
     * Changes the password for the currently authenticated user.
     *
     * Calls `POST /v1/user/auth/password` (CognitoAuthorizer Bearer token).
     *
     * @param oldPassword - The user's current password.
     * @param newPassword - The new password to set.
     * @returns A promise that resolves to a ChangePasswordResponse on success.
     * @throws {ESPAuthError} If not logged in or the API request fails.
     */
    changePassword(
      oldPassword: string,
      newPassword: string
    ): Promise<ChangePasswordResponse>;
  }
}

ESPRMNeoAuth.prototype.changePassword = async function (
  oldPassword: string,
  newPassword: string
): Promise<ChangePasswordResponse> {
  try {
    const accessToken = await ESPRMNeoStorage.getItem(StorageKeys.ACCESSTOKEN);
    if (!accessToken) {
      throw new ESPAuthError(
        AuthErrorCodes.NOT_LOGGED_IN,
        authErrorMessages.NOT_LOGGED_IN
      );
    }

    const api = ESPRMNeoAPIManager.getInstance();
    logger.debug(
      `changePassword → POST ${APIPathV1.USER_AUTH_PASSWORD} (Cognito Bearer)`
    );

    const requestBody: ChangePasswordRequest = {
      access_token: accessToken,
      old_password: oldPassword,
      new_password: newPassword,
    };

    const apiResponse = await api.postUserApiWithBearer<ChangePasswordApiResponse>(
      APIPathV1.USER_AUTH_PASSWORD,
      requestBody,
      accessToken
    );

    return normalizeApiResponse(apiResponse, {
      message: AuthSuccessMessages.PASSWORD_CHANGED,
    });
  } catch (err) {
    if (err instanceof ESPAuthError) throw err;
    const message =
      err instanceof Error
        ? err.message
        : authErrorMessages.CHANGE_PASSWORD_FAILED;
    logger.debug("changePassword → Error:", message);
    throw new ESPAuthError(
      AuthErrorCodes.CHANGE_PASSWORD_FAILED,
      message,
      err
    );
  }
};
