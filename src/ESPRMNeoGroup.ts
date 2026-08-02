/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ESPRMNeoGroup as ESPRMNeoGroupData,
  GroupUserAccessType,
  NodeCapabilityInfo,
} from "./types/output";

/** True when this instance is a nested group (child of another group). */
export function isChildGroup(g: ESPRMNeoGroup): boolean {
  return g.parentId != null && g.parentId !== "";
}

/**
 * Represents a group in the ESP Rainmaker Neo SDK.
 * Nested groups are also `ESPRMNeoGroup` instances with `parentId` set.
 *
 * Instance methods (attached via prototype in `methods/ESPRMNeoGroup/`):
 *   - Membership: `addNode`, `removeNode`, `getNode`, `getNodes`
 *   - Lifecycle:  `updateName`, `delete`, `leave`, `createSubGroup`
 *   - Sharing:    `share`, `getSharingInfo`, `removeMember`
 *   - Params:     `setParams`
 *   - Schedules:  `getSchedules`, `createSchedule`, `deleteAllSchedules`
 *   - Automation: `createAutomation`, `getAutomation`, `getAutomations`
 */
export class ESPRMNeoGroup implements ESPRMNeoGroupData {
  groupId: string;
  groupName: string;
  accessType?: GroupUserAccessType;
  /** Present only when this instance is a nested group (see {@link isChildGroup}). */
  parentId?: string;
  nodeIds: string[];
  subgroups: ESPRMNeoGroup[];
  nodeDetails: Record<string, NodeCapabilityInfo>;

  constructor(data: ESPRMNeoGroupData) {
    this.groupId = data.groupId;
    this.groupName = data.groupName;
    this.accessType = data.accessType;
    this.parentId = data.parentId;
    this.nodeIds = data.nodeIds ?? [];
    this.nodeDetails = data.nodeDetails ?? {};
    this.subgroups =
      data.subgroups?.map(
        (sg) =>
          new ESPRMNeoGroup({
            ...sg,
            parentId: sg.parentId ?? this.groupId,
          })
      ) ?? [];
  }
}
