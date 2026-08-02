/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPNodeUpdateData } from "../types/subscription";
import { Logger } from "../utils/logger";

const logger = new Logger("NodeUpdatesBus");

type NodeUpdateListener = (update: ESPNodeUpdateData) => void;

/**
 * Process-wide fan-out of normalized node parameter updates.
 *
 * Each {@link ESPRMNeoNode} feeds every update it receives (from whichever
 * subscription channel served it) into this bus, and `user.subscribe(
 * ESPRMNeoEventType.nodeUpdates, cb)` registers `cb` here. This gives consumers a
 * single "subscribe to all node param updates" entry point that mirrors the base
 * RainMaker SDK's `nodeUpdates` event — but actually wired, rather than the
 * reference SDK's manual-`subscribeToAllNodes` placeholder.
 */
const listeners = new Set<NodeUpdateListener>();

/**
 * Registers a listener for all node updates.
 *
 * @param listener - Invoked with each {@link ESPNodeUpdateData}.
 * @returns An unsubscribe function that removes the listener.
 */
export function subscribeNodeUpdates(listener: NodeUpdateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Emits a node update to every registered listener. Listener errors are isolated
 * so one bad subscriber cannot break delivery to the others.
 *
 * @param update - The normalized update to broadcast.
 */
export function emitNodeUpdate(update: ESPNodeUpdateData): void {
  listeners.forEach((listener) => {
    try {
      listener(update);
    } catch (error) {
      logger.error("nodeUpdates listener threw", error);
    }
  });
}

/**
 * Removes all listeners. Intended for teardown/tests.
 */
export function clearNodeUpdateListeners(): void {
  listeners.clear();
}
