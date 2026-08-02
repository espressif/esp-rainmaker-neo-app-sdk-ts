/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPRMNeoSharingRequest } from "../../ESPRMNeoSharingRequest";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { ListSharingRequestsResponse } from "../../types/output";
import { APIPathV1 } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("ListSharingRequests");

/**
 * Augments the ESPRMNeoUser class with the `listSharingRequests` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Retrieves sharing requests received by the current user.
     *
     * Calls `GET /v1/sharing-requests/received`.
     *
     * @returns A promise that resolves to an array of ESPRMNeoSharingRequest instances
     */
    listSharingRequests(): Promise<ESPRMNeoSharingRequest[]>;
  }
}

/**
 * Implementation of the `listSharingRequests` method for the `ESPRMNeoUser` class.
 */
ESPRMNeoUser.prototype.listSharingRequests = async function (): Promise<
  ESPRMNeoSharingRequest[]
> {
  logger.debug("listSharingRequests called");
  try {
    const response =
      await ESPSigV4APIManager.getInstance().get<ListSharingRequestsResponse>(
        APIPathV1.SHARING_REQUESTS_RECEIVED
      );

    const requests = (response.sharing_requests ?? []).map(
      (request) => new ESPRMNeoSharingRequest(request)
    );

    logger.debug("listSharingRequests succeeded", { count: requests.length });
    return requests;
  } catch (error) {
    logger.error(
      "listSharingRequests failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};
