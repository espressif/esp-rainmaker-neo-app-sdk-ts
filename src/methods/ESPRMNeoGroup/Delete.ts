/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPAPIResponse } from "../../types/output";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APIPathV1 } from "../../utils/constants";
import { resolveGroupPath } from "../../utils/groupUtils";
import { Logger } from "../../utils/logger";

const logger = new Logger("GroupDelete");

/**
 * Augments the ESPRMNeoGroup class with the `delete` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Deletes this group from the cloud.
     *
     * Calls:
     * - Root group: `DELETE /v1/groups/{groupId}`
     * - Nested subgroup: `DELETE /v1/groups/{groupId}/subgroups/{subGroupId}`
     *
     * After a successful delete this instance is stale. Callers should discard
     * it and drop it from any local caches (for a subgroup, remove it from its
     * parent's `subgroups` array — the SDK cannot reach the parent from here).
     *
     * @returns A promise that resolves with the API response when the group has been deleted.
     * @throws {Error} If the deletion fails or the API request fails.
     */
    delete(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.delete = async function (): Promise<ESPAPIResponse> {
  try {
    const api = ESPSigV4APIManager.getInstance();
    const path = resolveGroupPath(
      this,
      APIPathV1.group,
      APIPathV1.groupSubgroup
    );
    const response = await api.request<ESPAPIResponse>("DELETE", path);
    return normalizeApiResponse(response, {
      message: "Group deleted successfully",
    });
  } catch (error) {
    logger.error(
      "delete failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};

