/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ScheduleItem,
  ScheduleTrigger,
  ScheduleActionMap,
} from "./types/schedule";
import { ESPRMNeoNode } from "./ESPRMNeoNode";
import { ESPRMNeoGroup } from "./ESPRMNeoGroup";

/**
 * Represents a schedule in the ESP Rainmaker Neo SDK.
 * Provides instance methods for schedule operations.
 */
export class ESPRMNeoSchedule {
  id: string;
  name?: string;
  nodeId: string;
  groupId: string;
  enabled: boolean;
  triggers: ScheduleTrigger[];
  action: ScheduleActionMap;
  validity?: { start?: number; end?: number };
  private node?: ESPRMNeoNode;
  private group?: ESPRMNeoGroup;

  constructor(
    schedule: ScheduleItem,
    nodeId: string,
    groupId: string,
    id?: string,
    node?: ESPRMNeoNode,
    group?: ESPRMNeoGroup
  ) {
    this.enabled = schedule.enabled;
    this.triggers = schedule.triggers;
    this.action = schedule.action;
    this.validity = schedule.validity;
    this.name = schedule.name;
    this.nodeId = nodeId;
    this.groupId = groupId;
    this.node = node;
    this.group = group;
    this.id = id ?? schedule.id ?? ESPRMNeoSchedule.generateId();
  }

  /**
   * Gets the node instance for this schedule.
   * Returns the direct node reference when set, otherwise resolves it via the
   * group. Returns `null` when neither path yields a node.
   */
  async getNode(): Promise<ESPRMNeoNode | null> {
    if (this.node) {
      return this.node;
    }
    if (this.group) {
      try {
        return await this.group.getNode(this.nodeId);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Generates a schedule id when the caller doesn't provide one.
   * 4-char base36 tail (a-z, 0-9) — ~1.6M values per node. Duplicate ids
   * inside a single node's list are still guarded against at create-time by
   * {@link ESPRMNeoNode.createSchedule}.
   */
  private static generateId(): string {
    return `schedule_${Math.random().toString(36).slice(2, 6)}`;
  }
}
