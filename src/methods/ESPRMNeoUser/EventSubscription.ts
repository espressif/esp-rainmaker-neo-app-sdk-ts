/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import {
  DiscoveryParamsInterface,
  ESPEventCallback,
  ESPRMNeoEventType,
} from "../../types/discovery";
import { isEnumValue, isEmptyObject } from "../../utils/common";
import {
  startCustomDiscovery,
  startLocalDiscovery,
  startNodeUpdates,
} from "../../utils/eventSubscriptionUtils";

/**
 * Augments the ESPRMNeoUser class with event subscription methods.
 *
 * One callback is held per event — re-subscribing replaces the previous one.
 * Some events also start a backing source (LAN discovery, node-updates bus,
 * or custom discovery); that source is torn down on unsubscribe.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Subscribes a callback to an event (replaces any existing one).
     *
     * - {@link ESPRMNeoEventType.localDiscovery}: starts LAN discovery; each
     *   hit is delivered as {@link ESPDiscoveredNodeData}.
     * - {@link ESPRMNeoEventType.nodeUpdates}: forwards process-wide node
     *   param updates.
     * - Custom string event + `discoveryConfig`: starts discovery with that
     *   config and forwards raw results unchanged.
     */
    subscribe(
      event: ESPRMNeoEventType | string,
      callback: ESPEventCallback,
      discoveryConfig?: DiscoveryParamsInterface
    ): void;

    /** Removes the callback and stops any backing source for the event. */
    unsubscribe(event: ESPRMNeoEventType | string): void;

    /** Invokes the registered callback for `event` (if any) with `arg`. */
    trigger(event: ESPRMNeoEventType | string, arg: unknown): void;

    /** Clears one event, or every event when `event` is omitted. */
    removeAllCallbacks(event?: ESPRMNeoEventType | string): void;
  }
}

ESPRMNeoUser.prototype.subscribe = function (
  event: ESPRMNeoEventType | string,
  callback: ESPEventCallback,
  discoveryConfig?: DiscoveryParamsInterface
): void {
  this.unsubscribe(event);
  this.eventCallbacks[event] = callback;

  if (event === ESPRMNeoEventType.localDiscovery) {
    this.eventTeardowns[event] = startLocalDiscovery((data) =>
      this.trigger(event, data)
    );
    return;
  }

  if (event === ESPRMNeoEventType.nodeUpdates) {
    this.eventTeardowns[event] = startNodeUpdates((update) =>
      this.trigger(ESPRMNeoEventType.nodeUpdates, update)
    );
    return;
  }

  if (
    !isEnumValue(event, ESPRMNeoEventType) &&
    !isEmptyObject(discoveryConfig as Record<string, unknown> | undefined)
  ) {
    this.eventTeardowns[event] = startCustomDiscovery(
      discoveryConfig!,
      (info) => this.trigger(event, info)
    );
  }
};

ESPRMNeoUser.prototype.unsubscribe = function (
  event: ESPRMNeoEventType | string
): void {
  delete this.eventCallbacks[event];
  this.eventTeardowns[event]?.stop();
  delete this.eventTeardowns[event];
};

ESPRMNeoUser.prototype.trigger = function (
  event: ESPRMNeoEventType | string,
  arg: unknown
): void {
  this.eventCallbacks[event]?.(arg);
};

ESPRMNeoUser.prototype.removeAllCallbacks = function (
  event?: ESPRMNeoEventType | string
): void {
  if (event) {
    this.unsubscribe(event);
    return;
  }
  const events = new Set([
    ...Object.keys(this.eventCallbacks),
    ...Object.keys(this.eventTeardowns),
  ]);
  for (const key of events) {
    this.unsubscribe(key);
  }
};
