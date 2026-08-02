/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../ESPRMNeoGroup";
import { ESPAPIResponse } from "../../types/output";
import { Logger } from "../../utils/logger";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

const logger = new Logger("DeleteAllSchedules");

/**
 * Augments the ESPRMNeoGroup class with the `deleteAllSchedules` method.
 */
declare module "../../ESPRMNeoGroup" {
  interface ESPRMNeoGroup {
    /**
     * Deletes all schedules for all nodes in this group.
     *
     * For each node, calls `DELETE /v1/groups/{groupId}/nodes/{nodeId}/schedules`.
     *
     * @returns A promise that resolves with the API response when all schedules are deleted.
     */
    deleteAllSchedules(): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoGroup.prototype.deleteAllSchedules = async function (): Promise<ESPAPIResponse> {
  const nodes = await this.getNodes({ cache: false });
  const settled = await Promise.allSettled(
    nodes.map((node) => node.removeAllSchedules())
  );

  const failures: Array<{ nodeId: string; error: string }> = [];
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      failures.push({ nodeId: nodes[index].nodeId, error: message });
      logger.error(
        `Failed to delete schedules for node ${nodes[index].nodeId}`,
        message
      );
    }
  });

  if (failures.length > 0) {
    const summary = failures.map((f) => `${f.nodeId}: ${f.error}`).join("; ");
    throw new Error(
      `Failed to delete schedules on ${failures.length} of ${nodes.length} nodes — ${summary}`
    );
  }

  return normalizeApiResponse(null, {
    message: `All schedules deleted (${nodes.length} nodes)`,
  });
};
