/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPRMNeoSchedule } from "../../ESPRMNeoSchedule";
import { ScheduleItem } from "../../types/schedule";
import {
  APICallValidationErrorCodes,
  ScheduleErrorMessages,
} from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { Logger } from "../../utils/logger";
import { concurrentFetchPool } from "../../utils/mapLimit";
import { ScheduleValidator } from "../../utils/validator/ScheduleValidator";

const logger = new Logger("CreateSchedule");

/** Max concurrent per-node schedule writes when applying a batch on a group. */
const CREATE_SCHEDULE_CONCURRENCY = 5;

/**
 * Augments the ESPRMNeoGroup class with the `createSchedule` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Creates schedules for multiple nodes in this group.
     *
     * For each node, calls `PUT /v1/groups/{groupId}/nodes/{nodeId}/schedules`.
     *
     * @param nodeSchedules - Array of objects, each containing a nodeId and its schedules.
     * @returns A promise that resolves to the created schedules across all nodes.
     * @throws {ESPAPICallValidationError} If nodeSchedules or schedule data is invalid, or any node is not found.
     * @throws {Error} If creating schedules fails on one or more nodes.
     */
    createSchedule(
      nodeSchedules: Array<{ nodeId: string; schedules: ScheduleItem[] }>
    ): Promise<ESPRMNeoSchedule[]>;
  }
}

ESPRMNeoGroup.prototype.createSchedule = async function (
  nodeSchedules: Array<{ nodeId: string; schedules: ScheduleItem[] }>
): Promise<ESPRMNeoSchedule[]> {
  ScheduleValidator.validateNodeSchedules(nodeSchedules);

  const nodes = await this.getNodes();
  const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));

  // Pre-flight: fail fast if any requested nodeId is not part of this group.
  // Input validation should stop the batch before any writes happen — a
  // partial write from a bad-input case is worse than no write at all.
  const missing = nodeSchedules
    .map(({ nodeId }) => nodeId)
    .filter((id) => !nodeMap.has(id));
  if (missing.length > 0) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.SCHEDULE_NODE_NOT_FOUND
    );
  }

  const results: ESPRMNeoSchedule[][] = new Array(nodeSchedules.length);
  const failures: Array<{ nodeId: string; error: string }> = [];
  await concurrentFetchPool(
    CREATE_SCHEDULE_CONCURRENCY,
    nodeSchedules.map((entry, index) => ({ entry, index })),
    async ({ entry, index }) => {
      const { nodeId, schedules } = entry;
      try {
        results[index] = await nodeMap.get(nodeId)!.createSchedule(schedules);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        failures.push({ nodeId, error: message });
        logger.error("Failed to create schedules for node", {
          groupId: this.groupId,
          nodeId,
          error: message,
        });
      }
    }
  );

  if (failures.length > 0) {
    const summary = failures.map((f) => `${f.nodeId}: ${f.error}`).join("; ");
    throw new Error(
      ScheduleErrorMessages.CREATE_FAILED(
        failures.length,
        nodeSchedules.length,
        summary
      )
    );
  }

  return results.flat();
};
