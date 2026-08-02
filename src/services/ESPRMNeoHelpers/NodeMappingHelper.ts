/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPSigV4APIManager } from "../ESPSigV4APIManager";
import { APIPathV1 } from "../../utils/constants";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Helper module for managing node mapping-related operations.
 */
export class NodeMappingHelper {
  /**
   * Initiates a user node mapping request.
   *
   * @param groupId - The ID of the group to associate the node with.
   * @param requestBody - The request body for the user node mapping.
   * @returns A promise that resolves to the response from the API.
   */
  static async initiateUserNodeMapping(
    groupId: string,
    requestBody: Record<string, unknown> = {}
  ): Promise<unknown> {
    const api = ESPSigV4APIManager.getInstance();
    const endpoint = APIPathV1.USER_NODE_MAPPING_INITIATE(groupId);
    return api.post(endpoint, requestBody);
  }

  /**
   * Verifies the mapping between a user and a node.
   *
   * @param groupId - The ID of the group.
   * @param requestId - The node association request ID.
   * @param requestBody - The request body for the user node mapping verification.
   * @returns A promise that resolves to the response from the API.
   */
  static async verifyUserNodeMapping(
    groupId: string,
    requestId: string,
    requestBody: Record<string, unknown> = {}
  ): Promise<{ message?: string; node_id?: string; challenge_response?: string }> {
    const api = ESPSigV4APIManager.getInstance();
    const endpoint = APIPathV1.USER_NODE_MAPPING_VERIFY(groupId, requestId);
    const response = await api.post(endpoint, requestBody);
    return normalizeApiResponse(response, { message: "User node mapping verified successfully" });
  }
}
