/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPRMNeoSchedule } from "../../ESPRMNeoSchedule";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { ScheduleItem } from "../../types/schedule";
import { APIPathV1 } from "../../utils/constants";

/**
 * Augments the ESPRMNeoNode class with the `getSchedules` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Retrieves all schedules for this node.
     *
     * Calls `GET /v1/groups/{groupId}/nodes/{nodeId}/schedules`.
     *
     * @returns A promise that resolves to an array of ESPRMNeoSchedule instances.
     * @throws {Error} If retrieving schedules fails or the API request fails.
     */
    getSchedules(): Promise<ESPRMNeoSchedule[]>;
  }
}

ESPRMNeoNode.prototype.getSchedules = async function (): Promise<
  ESPRMNeoSchedule[]
> {
  const endpoint = APIPathV1.groupNodeSchedules(this.groupId, this.nodeId);
  const api = ESPSigV4APIManager.getInstance();
  const response = await api.get<{ schedules?: unknown[] }>(endpoint);
  const items = (Array.isArray(response?.schedules)
    ? response.schedules
    : []) as ScheduleItem[];
  return items.map(
    (schedule) =>
      new ESPRMNeoSchedule(
        schedule,
        this.nodeId,
        this.groupId,
        schedule.id,
        this
      )
  );
};
