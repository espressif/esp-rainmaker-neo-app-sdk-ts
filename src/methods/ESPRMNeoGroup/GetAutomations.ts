/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPRMNeoAutomation } from "../../ESPRMNeoAutomation";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import {
  AutomationItem,
  GetAutomationApiResponse,
} from "../../types/automation";
import { APIPathV1 } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("GetAutomations");

/**
 * Augments the ESPRMNeoGroup class with the `getAutomations` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Retrieves all automations for this group.
     *
     * Calls `GET /v1/groups/{groupId}/service/automations`.
     *
     * @returns A promise that resolves to an array of ESPRMNeoAutomation instances.
     * @throws {Error} If retrieving automations fails or the API request fails.
     */
    getAutomations(): Promise<ESPRMNeoAutomation[]>;
  }
}

ESPRMNeoGroup.prototype.getAutomations = async function (): Promise<
  ESPRMNeoAutomation[]
> {
  try {
    const endpoint = APIPathV1.groupAutomation(this.groupId);
    const api = ESPSigV4APIManager.getInstance();
    const response = await api.get<{
      automations?: GetAutomationApiResponse[];
    }>(endpoint);
    const raws = response.automations ?? [];
    return raws.map(
      (raw) => new ESPRMNeoAutomation(raw as AutomationItem, this)
    );
  } catch (error) {
    logger.error(
      "getAutomations failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};
