/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { ESPAPIResponse, ShareOptions } from "../../types/output";
import { APICallValidationErrorCodes, APIPathV1 } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { resolveGroupPath } from "../../utils/groupUtils";
import { Logger } from "../../utils/logger";

const logger = new Logger("Share");

/**
 * Augments the ESPRMNeoGroup class with the `share` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Shares this group with another user.
     *
     * Calls:
     * - Root group: `POST /v1/groups/{groupId}/sharing-requests`
     * - Nested subgroup: `POST /v1/groups/{groupId}/subgroups/{subGroupId}/sharing-requests`
     *
     * @param options - Sharing options.
     * @param options.username - Recipient's email address or E.164 phone number
     *   (e.g. `"user@example.com"` or `"+919876543210"`). Unregistered addresses
     *   answer HTTP 404 without revealing whether an account exists.
     * @param options.accessType - `"primary"` (transfer ownership) or `"secondary"` (invite as member).
     * @returns A promise that resolves to the API response.
     * @throws {ESPAPICallValidationError} If `username` is missing.
     * @throws {Error} If the API request fails.
     */
    share(options: ShareOptions): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.share = async function (
  options: ShareOptions
): Promise<ESPAPIResponse> {
  if (!options.username?.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_USERNAME
    );
  }
  try {
    const api = ESPSigV4APIManager.getInstance();
    const requestData = {
      username: options.username,
      access_type: options.accessType,
    };
    const path = resolveGroupPath(
      this,
      APIPathV1.groupSharingRequests,
      APIPathV1.groupSubgroupSharingRequests
    );
    return api.request<ESPAPIResponse>("POST", path, requestData);
  } catch (error) {
    logger.error(
      "share failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};
