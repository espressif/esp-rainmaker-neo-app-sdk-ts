/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPRMNeoSchedule } from "../../ESPRMNeoSchedule";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { ScheduleItem } from "../../types/schedule";
import { Logger } from "../../utils/logger";
import { APIPathV1 } from "../../utils/constants";
import { concurrentFetchPool } from "../../utils/mapLimit";

const logger = new Logger("GetSchedules");

/** Max concurrent per-node schedule fetches while aggregating a group. */
const GET_SCHEDULES_CONCURRENCY = 5;

/**
 * Augments the ESPRMNeoGroup class with the `getSchedules` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Retrieves all schedules for all nodes in this group.
     * Aggregates schedules from all nodes in the group via
     * `GET /v1/groups/{groupId}/nodes/{nodeId}/schedules` per node.
     *
     * @returns A promise that resolves to an array of ESPRMNeoSchedule instances.
     */
    getSchedules(): Promise<ESPRMNeoSchedule[]>;
  }
}

ESPRMNeoGroup.prototype.getSchedules = async function (): Promise<
  ESPRMNeoSchedule[]
> {
  if (!this.nodeIds.length) return [];

  const api = ESPSigV4APIManager.getInstance();
  const results = await concurrentFetchPool(
    GET_SCHEDULES_CONCURRENCY,
    this.nodeIds,
    async (nodeId) => {
      try {
        const endpoint = APIPathV1.groupNodeSchedules(this.groupId, nodeId);
        const response = await api.get<{ schedules?: unknown[] }>(endpoint);
        const schedulesArray = Array.isArray(response?.schedules)
          ? response.schedules
          : [];
        return schedulesArray.map(
          (schedule) =>
            new ESPRMNeoSchedule(
              schedule as ScheduleItem,
              nodeId,
              this.groupId,
              (schedule as ScheduleItem).id,
              undefined,
              this
            )
        );
      } catch (error) {
        logger.error("Failed to get schedules for node", {
          groupId: this.groupId,
          nodeId,
          error,
        });
        return [];
      }
    }
  );
  return results.flat();
};
