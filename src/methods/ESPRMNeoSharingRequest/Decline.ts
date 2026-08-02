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

const logger = new Logger("SharingRequestDecline");

/**
 * Augments the ESPRMNeoSharingRequest class with the `decline` method.
 */
declare module "../../ESPRMNeoSharingRequest" {
  interface ESPRMNeoSharingRequest {
    /**
     * Declines this sharing request, denying access to the shared group/subgroup.
     *
     * Calls `POST /v1/sharing-requests/{requestId}/reject`.
     *
     * @returns A promise that resolves when the sharing request is successfully declined.
     * @throws If the request fails.
     */
    decline(): Promise<SuccessResponse>;
  }
}

ESPRMNeoSharingRequest.prototype.decline =
  async function (): Promise<SuccessResponse> {
    logger.debug("decline called", {
      sharingRequestId: this.sharingRequestId,
    });
    
    try {
      const api = ESPSigV4APIManager.getInstance();
      const endpoint = APIPathV1.sharingRequestReject(this.sharingRequestId);
      const response = await api.post<SuccessResponse>(endpoint, {});
      const result = normalizeApiResponse(response, {
        message: SharingSuccessMessages.DECLINED,
      });

      logger.debug("decline succeeded", {
        sharingRequestId: this.sharingRequestId,
      });
      
      return result;
    
    } catch (err) {
      logger.error(
        "decline failed",
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }
  };
