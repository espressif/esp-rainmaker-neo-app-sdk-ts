/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPRMNeoTrigger } from "../../ESPRMNeoTrigger";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { TriggerItem } from "../../types/trigger";
import { APIPathV1, TriggerErrorMessages } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("GetTriggers");

/**
 * Augments the ESPRMNeoNode class with the `getTriggers` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Retrieves all triggers for this node.
     *
     * Calls `GET /v1/groups/{groupId}/nodes/{nodeId}/triggers`.
     *
     * @returns A promise that resolves to an array of ESPRMNeoTrigger instances.
     * @throws {Error} If the API request fails.
     */
    getTriggers(): Promise<ESPRMNeoTrigger[]>;
  }
}

ESPRMNeoNode.prototype.getTriggers = async function (): Promise<
  ESPRMNeoTrigger[]
> {
  try {
    const endpoint = APIPathV1.groupNodeTriggers(this.groupId, this.nodeId);
    const api = ESPSigV4APIManager.getInstance();
    const response = await api.get<{ triggers?: TriggerItem[] }>(endpoint);
    const triggers = Array.isArray(response?.triggers) ? response.triggers : [];
    return triggers.map((trigger) => new ESPRMNeoTrigger(trigger, this));
  } catch (err) {
    logger.error(
      TriggerErrorMessages.GET_FAILED,
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
};
