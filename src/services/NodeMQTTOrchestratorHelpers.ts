/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MQTTTransport } from "./interfaces/MQTTTransport";
import { Logger } from "../utils/logger";

const logger = new Logger("NodeMQTTOrchestratorHelpers");

/** Pending request for cleanup on clear() */
export interface PendingRequest {
  timer: ReturnType<typeof setTimeout>;
  handler: (topic: string, payload: Buffer) => void;
  reject: (err: Error) => void;
  /** MQTT topics this handler was subscribed to (for unsubscribe) */
  topicsToUnsubscribe: string[];
}

/** Shadow subscription state */
export interface ShadowSubscriptionState {
  /** All wildcard topics for this shadow (documents/delta/accepted/rejected, get) */
  topics: string[];
  listeners: Map<string, Set<(params: unknown) => void>>;
  subscribed: boolean;
  handler?: (topic: string, payload: Buffer) => void;
}

/**
 * Clears all pending request-response operations.
 * Rejects each with the given error and unsubscribes from response topics.
 *
 * @param pendingRequests - Map of responseTopic → pending request
 * @param transport - MQTT transport for unsubscribe
 * @param rejectError - Error to reject pending promises with
 */
export function clearAllPendingRequests(
  pendingRequests: Map<string, PendingRequest>,
  transport: MQTTTransport | null,
  rejectError: Error
): void {
  pendingRequests.forEach((pendingRequest) => {
    clearTimeout(pendingRequest.timer);
    for (const t of pendingRequest.topicsToUnsubscribe) {
      transport?.unsubscribe(t, pendingRequest.handler).catch(() => {
        logger.error("Failed to unsubscribe from topic", t);
      });
    }
    pendingRequest.reject(rejectError);
  });
  pendingRequests.clear();
}

/**
 * Unsubscribes from shadow topic when no listeners remain.
 * Cleans up subscription state to avoid orphaned MQTT subscriptions.
 *
 * @param subscription - The shadow subscription state
 * @param transport - MQTT transport for unsubscribe
 * @returns true if unsubscribed, false otherwise
 */
export function cleanupSubscriptionIfIdle(
  subscription: ShadowSubscriptionState,
  transport: MQTTTransport | null
): boolean {
  const isIdle =
    subscription.listeners.size === 0 &&
    subscription.subscribed &&
    subscription.handler &&
    transport;

  if (!isIdle) return false;

  for (const t of subscription.topics) {
    transport.unsubscribe(t, subscription.handler!).catch(() => {
      logger.error("Failed to unsubscribe from topic", t);
    });
  }
  subscription.subscribed = false;
  subscription.handler = undefined;

  return true;
}

/**
 * Invokes all listeners with the given params.
 * Isolates errors from individual listeners so one failure cannot block the
 * others. Logs the actual error (and the params for context) so investigators
 * can see WHY a listener failed, not just THAT one did.
 *
 * @param listeners - Set of callback functions
 * @param params - The params to pass to each listener
 */
export function notifyListenersSafely(
  listeners: Set<(params: unknown) => void>,
  params: unknown
): void {
  listeners.forEach((callback) => {
    try {
      callback(params);
    } catch (err) {
      logger.error("Listener threw while handling shadow update", {
        error: err instanceof Error ? err.message : String(err),
        params,
      });
    }
  });
}
