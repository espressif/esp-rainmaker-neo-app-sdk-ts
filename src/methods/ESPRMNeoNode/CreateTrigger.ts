/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPRMNeoTrigger } from "../../ESPRMNeoTrigger";
import { TriggerItem } from "../../types/trigger";
import { ESPAPIResponse } from "../../types/output";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { APICallValidationErrorCodes, APIPathV1 } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoNode class with the `createTrigger` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Creates triggers on this node.
     *
     * - Pass a single {@link TriggerItem} to append it while preserving existing
     *   triggers (GET current list, then PUT the merged list).
     * - Pass an array to replace all triggers in one PUT. Pass `[]` to clear.
     *
     * Calls `PUT /v1/groups/{groupId}/nodes/{nodeId}/triggers`.
     *
     * Single-item append is not safe under concurrent calls to the same node —
     * two simultaneous creates can read the same existing list and the later
     * PUT wins. Callers appending many triggers should build the array locally
     * and pass it once.
     *
     * @param triggers - One trigger to append, or the full list to set.
     * @returns The created trigger, or the full list after a replace-all PUT.
     * @throws {ESPAPICallValidationError} If the argument is invalid, or a single
     *   trigger's id is missing / already exists.
     * @throws {Error} If the API request fails.
     */
    createTrigger(trigger: TriggerItem): Promise<ESPRMNeoTrigger>;
    createTrigger(triggers: TriggerItem[]): Promise<ESPRMNeoTrigger[]>;
  }
}

ESPRMNeoNode.prototype.createTrigger = async function (
  this: ESPRMNeoNode,
  triggers: TriggerItem | TriggerItem[]
): Promise<ESPRMNeoTrigger | ESPRMNeoTrigger[]> {
  if (Array.isArray(triggers)) {
    const endpoint = APIPathV1.groupNodeTriggers(this.groupId, this.nodeId);
    const api = ESPSigV4APIManager.getInstance();
    await api.put<ESPAPIResponse>(endpoint, {
      triggers,
    });
    return triggers.map((trigger) => new ESPRMNeoTrigger(trigger, this));
  }

  const trigger = triggers;
  if (!trigger || typeof trigger !== "object") {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_TRIGGER
    );
  }
  if (!trigger.id || typeof trigger.id !== "string" || !trigger.id.trim()) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_TRIGGER_ID
    );
  }

  const existing = await this.getTriggers();
  if (existing.some((t) => t.id === trigger.id)) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.TRIGGER_ALREADY_EXISTS
    );
  }

  const created = await this.createTrigger([
    ...existing.map((t) => t.toTriggerItem()),
    trigger,
  ]);
  return created.find((t) => t.id === trigger.id)!;
} as ESPRMNeoNode["createTrigger"];
