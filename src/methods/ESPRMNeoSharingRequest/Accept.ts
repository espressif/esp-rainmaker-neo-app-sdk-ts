/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoSharingRequest } from "../../ESPRMNeoSharingRequest";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { SuccessResponse } from "../../types/output";
import { APIPathV1, SharingSuccessMessages } from "../../utils/constants";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { Logger } from "../../utils/logger";

const logger = new Logger("SharingRequestAccept");

/**
 * Augments the ESPRMNeoSharingRequest class with the `accept` method.
 */
declare module "../../ESPRMNeoSharingRequest" {
  interface ESPRMNeoSharingRequest {
    /**
     * Accepts this sharing request, granting the requester access to the shared group/subgroup.
     *
     * Calls `POST /v1/sharing-requests/{requestId}/accept`.
     *
     * @returns A promise that resolves when the sharing request is successfully accepted.
     * @throws If the request fails.
     */
    accept(): Promise<SuccessResponse>;
  }
}

ESPRMNeoSharingRequest.prototype.accept =
  async function (): Promise<SuccessResponse> {
    logger.debug("accept called", {
      sharingRequestId: this.sharingRequestId,
    });

    try {

      const api = ESPSigV4APIManager.getInstance();
      const endpoint = APIPathV1.sharingRequestAccept(this.sharingRequestId);
      const response = await api.post<SuccessResponse>(endpoint, {});
      const result = normalizeApiResponse(response, {
        message: SharingSuccessMessages.ACCEPTED,
      });

      logger.debug("accept succeeded", {
        sharingRequestId: this.sharingRequestId,
      });

      return result;
      
    } catch (err) {
      logger.error(
        "accept failed",
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }
  };
