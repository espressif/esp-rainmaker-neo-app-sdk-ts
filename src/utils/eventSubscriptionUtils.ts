/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDiscoveryManager } from "../services/ESPTransport/ESPDiscovery/ESPDiscoveryManager";
import { subscribeNodeUpdates } from "../services/NodeUpdatesBus";
import {
  DiscoveryParamsInterface,
  ESPDiscoveredNodeData,
} from "../types/discovery";
import { ESPNodeUpdateData } from "../types/subscription";
import { ESPTransportMode } from "../types/transport";

/** Handle that stops whatever backing source a subscribe() started. */
export type EventTeardown = { stop(): void };

/** Maps a default local-discovery hit into the client-facing payload shape. */
export function toDiscoveredNodeData(
  info: Record<string, any>
): ESPDiscoveredNodeData {
  return {
    nodeId: info.nodeId,
    transportDetails: {
      type: ESPTransportMode.local,
      metadata: { baseUrl: info.baseUrl },
    },
  };
}

/** Starts LAN discovery; each hit is mapped then passed to `onDiscovered`. */
export function startLocalDiscovery(
  onDiscovered: (data: ESPDiscoveredNodeData) => void
): EventTeardown {
  const manager = new ESPDiscoveryManager();
  manager.startDiscovery((info) => onDiscovered(toDiscoveredNodeData(info)));
  return { stop: () => manager.stopDiscovery() };
}

/** Forwards process-wide node param updates to `onUpdate`. */
export function startNodeUpdates(
  onUpdate: (update: ESPNodeUpdateData) => void
): EventTeardown {
  const unsubscribe = subscribeNodeUpdates(onUpdate);
  return { stop: unsubscribe };
}

/**
 * Starts discovery with a custom config; raw adapter results are forwarded
 * unchanged (caller interprets them).
 */
export function startCustomDiscovery(
  config: DiscoveryParamsInterface,
  onInfo: (info: Record<string, any>) => void
): EventTeardown {
  const manager = new ESPDiscoveryManager(config);
  manager.startDiscovery(onInfo);
  return { stop: () => manager.stopDiscovery() };
}
