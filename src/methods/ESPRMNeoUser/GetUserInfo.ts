/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPRMNeoAPIManager } from "../../services/ESPRMNeoAPIManager";
import { ESPRMNeoUserInfo, GetUserApiResponse } from "../../types/auth";
import { APIPathV1, GroupUserAliases } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("GetUserInfo");

/**
 * Augments the ESPRMNeoUser class with the `getUserInfo` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Retrieves user information from `GET /v1/users/me`.
     *
     * @returns A promise that resolves to an `ESPRMNeoUserInfo` object containing the user information.
     */
    getUserInfo(): Promise<ESPRMNeoUserInfo>;
  }
}

/**
 * Implementation of the getUserInfo method for the ESPRMNeoUser class.
 *
 * @returns A promise that resolves to RainMaker user info.
 */
ESPRMNeoUser.prototype.getUserInfo =
  async function (): Promise<ESPRMNeoUserInfo> {
    const accessToken = await this.getAccessToken();

    // Always "me": the backend accepts {userId} = "me" or the RainMaker
    // custom:user_id claim ONLY — a Cognito `sub` gets 403 Forbidden
    // (verified against the backend's handleGetUser).
    const endpoint = APIPathV1.user(GroupUserAliases.CURRENT);
    logger.debug(`getUserInfo → GET ${endpoint}`);

    const profile =
      await ESPRMNeoAPIManager.getInstance().getUserApiWithBearer<GetUserApiResponse>(
        endpoint,
        accessToken
      );

    const username =
      profile.phone_number || profile.email || profile.user_id;

    return {
      username,
      userId: profile.user_id,
      userAttributes: {
        ...(profile.email ? { email: profile.email } : {}),
        ...(profile.phone_number ? { phone_number: profile.phone_number } : {}),
        ...(profile.user_id ? { user_id: profile.user_id } : {}),
      },
    };
  };
