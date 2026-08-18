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
import { ESPLocalControlProtocol, ESPTransportMode } from "../types/transport";
import { RMakerLocalCtrlCapability, RMakerLocalCtrlTxtKey } from "./constants";

/** Handle that stops whatever backing source a subscribe() started. */
export type EventTeardown = { stop(): void };

/**
 * Splits the mDNS `cap` TXT record (`"local_ctrl,ch_resp"`) into tokens.
 * Returns `undefined` when the record is absent, which older firmware omits.
 */
function parseCapabilities(txt: unknown): string[] | undefined {
  const raw = (txt as Record<string, unknown> | undefined)?.[
    RMakerLocalCtrlTxtKey.CAP
  ];
  if (typeof raw !== "string") return undefined;
  const capabilities = raw
    .split(",")
    .map((capability) => capability.trim())
    .filter(Boolean);
  return capabilities.length ? capabilities : undefined;
}

/**
 * Maps a default local-discovery hit into the client-facing payload shape.
 *
 * The `_esp_rmaker_ctrl._tcp` instance is also advertised by nodes that
 * only serve challenge-response (on-network user-node association). Those are
 * not reachable for param control, so a hit whose `cap` TXT record excludes
 * `local_ctrl` maps to `undefined` and is dropped rather than registered as a
 * local transport. A hit with no `cap` record is treated as control-capable.
 *
 * @param info - Raw adapter result (`nodeId`, `baseUrl`, and `txt` when the
 *   platform resolved TXT records).
 * @returns The payload to deliver, or `undefined` to skip this hit.
 */
export function toDiscoveredNodeData(
  info: Record<string, any>
): ESPDiscoveredNodeData | undefined {
  const capabilities = parseCapabilities(info.txt);
  if (
    capabilities &&
    !capabilities.includes(RMakerLocalCtrlCapability.LOCAL_CTRL)
  ) {
    return undefined;
  }

  return {
    nodeId: info.nodeId,
    transportDetails: {
      type: ESPTransportMode.local,
      metadata: {
        baseUrl: info.baseUrl,
        protocol: ESPLocalControlProtocol.rmakerLocalCtrl,
        ...(capabilities && { capabilities }),
      },
    },
  };
}

/**
 * Starts LAN discovery; each hit is mapped then passed to `onDiscovered`.
 * Hits that are not control-capable (see {@link toDiscoveredNodeData}) are
 * skipped.
 */
export function startLocalDiscovery(
  onDiscovered: (data: ESPDiscoveredNodeData) => void
): EventTeardown {
  const manager = new ESPDiscoveryManager();
  manager.startDiscovery((info) => {
    const data = toDiscoveredNodeData(info);
    if (data) onDiscovered(data);
  });
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
