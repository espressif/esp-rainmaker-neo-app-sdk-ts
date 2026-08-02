/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { TriggerItem, TriggerOperator } from "./types/trigger";
import { ESPRMNeoNode } from "./ESPRMNeoNode";
import { triggerToItem } from "./utils/triggerUtils";

/**
 * Represents a trigger in the ESP Rainmaker Neo SDK.
 * Provides instance methods for trigger operations.
 * Holds a WeakRef to the parent node, matching the pattern used by
 * ESPRMNeoDevice / ESPRMNeoService / ESPRMNeoDeviceParam.
 */
export class ESPRMNeoTrigger {
  id: string;
  nodeId: string;
  groupId: string;
  type: string;
  enabled?: boolean;
  path: string;
  operator: TriggerOperator;
  value: unknown;

  readonly _nodeRef: WeakRef<ESPRMNeoNode>;

  constructor(data: TriggerItem, node: ESPRMNeoNode) {
    this.id = data.id;
    this.type = data.type;
    this.enabled = data.enabled;
    this.path = data.path;
    this.operator = data.operator;
    this.value = data.value;
    this.nodeId = node.nodeId;
    this.groupId = node.groupId;
    this._nodeRef = new WeakRef(node);
  }

  /** Parent node, if the weak reference is still alive. */
  getNode(): ESPRMNeoNode | undefined {
    return this._nodeRef.deref();
  }

  /**
   * Converts this trigger to a plain TriggerItem (for building API payloads).
   */
  toTriggerItem(): TriggerItem {
    return triggerToItem(this);
  }
}
