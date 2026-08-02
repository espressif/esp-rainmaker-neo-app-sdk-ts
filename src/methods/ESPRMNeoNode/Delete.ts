/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPAPIResponse } from "../../types/output";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  APIPathV1,
  HTTPMethods,
  NodeSuccessMessages,
} from "../../utils/constants";
import { clearLocalNodeCache } from "../../utils/nodeUtils";
import { Logger } from "../../utils/logger";

const logger = new Logger("NodeDelete");

/**
 * Augments the ESPRMNeoNode class with the `delete` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Fully disassociates this node from the cloud account.
     * Calls `DELETE /v1/groups/{groupId}/nodes/{nodeId}` at the root group.
     *
     * @returns A promise that resolves with the API response when the node has been deleted.
     * @throws {Error} If the deletion fails or the API request fails.
     */
    delete(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoNode.prototype.delete = async function (): Promise<ESPAPIResponse> {
  try {
    const api = ESPSigV4APIManager.getInstance();
    const path = APIPathV1.groupNode(this.groupId, this.nodeId);
    const response = await api.request<ESPAPIResponse>(HTTPMethods.DELETE, path);

    await clearLocalNodeCache(this.nodeId);

    return normalizeApiResponse(response, {
      message: NodeSuccessMessages.NODE_DELETED,
    });
  } catch (error) {
    logger.error(
      "delete failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};
