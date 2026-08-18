/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoBase } from "../../ESPRMNeoBase";
import type {
  ESPLocalControlAdapterInterface,
  ESPLocalControlSessionOptions,
} from "../../types/localControl";

/** Attempts made before a local-control handshake is reported as failed. */
const DEFAULT_CONNECT_RETRIES = 3;

/**
 * Returns the app-supplied local control adapter.
 *
 * @throws {Error} When no adapter was registered on {@link ESPRMNeoBase}.
 */
export function getLocalControlAdapter(): ESPLocalControlAdapterInterface {
  const adapter = ESPRMNeoBase.getLocalControlAdapter();
  if (!adapter) {
    throw new Error("Local control adapter is not configured");
  }
  return adapter;
}

/**
 * Ensures a usable local-control session for `nodeId`, connecting (with
 * retries) when the adapter reports none.
 *
 * The adapter resolves on a successful handshake and rejects otherwise, so a
 * resolved `connect` is treated as connected.
 *
 * @param adapter - Adapter to drive.
 * @param nodeId - Node to connect to.
 * @param metadata - Local transport metadata (`baseUrl`, `securityType`, `pop`,
 *   `username`).
 * @param options - Session endpoints for the protocol in use; omitted for the
 *   adapter's built-in default paths.
 * @param maxRetries - Connection attempts before failing.
 * @throws {Error} When every connection attempt fails.
 */
export async function ensureLocalControlSession(
  adapter: ESPLocalControlAdapterInterface,
  nodeId: string,
  metadata: Record<string, any>,
  options?: ESPLocalControlSessionOptions,
  maxRetries: number = DEFAULT_CONNECT_RETRIES
): Promise<void> {
  if (await adapter.isConnected(nodeId)) {
    return;
  }

  let attempt = 0;
  let lastError: unknown;
  while (attempt < maxRetries) {
    try {
      await adapter.connect(
        nodeId,
        metadata.baseUrl,
        metadata.securityType ?? 0,
        metadata.pop,
        metadata.username,
        options
      );
      return;
    } catch (error: unknown) {
      lastError = error;
      attempt += 1;
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to connect after ${maxRetries} attempts: ${message}`);
}
