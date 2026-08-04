/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPTransportConfig } from "./transport";

/**
 * Discovery protocol / domain identifiers.
 */
enum ESPDiscoveryProtocol {
  local = "local",
}

/**
 * Events an app can subscribe to via {@link ESPRMNeoUser.subscribe}.
 */
enum ESPRMNeoEventType {
  /** Local (mDNS / LAN) node discovery. */
  localDiscovery = "com.espressif.event.localDiscovery",
  /**
   * All-node parameter updates. Subscribers receive an `ESPNodeUpdateData` for
   * every node param change, from whichever subscription channel served the
   * node. Backed by the process-wide node-updates bus.
   */
  nodeUpdates = "com.espressif.event.nodeUpdates",
}

/**
 * Parameters passed to a local-discovery adapter to scope the search
 * (e.g. mDNS service type and domain).
 */
interface DiscoveryParamsInterface {
  /** Service type to browse for, e.g. `_esp_local_ctrl._tcp.` */
  serviceType: string;
  /** Discovery domain, e.g. `local`. */
  domain: string;
}

/** Callback invoked by a discovery adapter for each discovered node. */
type ESPDiscoveryCallback = (info: Record<string, any>) => void;

/** Callback invoked for a subscribed event (see {@link ESPRMNeoUser.subscribe}). */
type ESPEventCallback = (arg: any) => void;

/**
 * Adapter the app supplies to perform local (LAN / mDNS) discovery. The SDK
 * starts/stops discovery through this adapter and forwards each result to the
 * app's subscribed callback.
 */
interface ESPLocalDiscoveryAdapterInterface {
  /**
   * Starts the discovery process.
   * @param callback - Invoked for each discovered node. Receives at least
   *   `{ nodeId, baseUrl }` for the default local protocol.
   * @param params - Discovery parameters (service type / domain).
   */
  startDiscovery(
    callback: ESPDiscoveryCallback,
    params: DiscoveryParamsInterface
  ): void;

  /**
   * Stops the discovery process.
   */
  stopDiscovery(): void;
}

/**
 * Standardized payload delivered to a `localDiscovery` subscriber. The
 * subscriber typically applies `transportDetails` to the matching node's
 * `availableTransports` (e.g. via
 * `node.addTransport(transportDetails.type, transportDetails)`).
 */
interface ESPDiscoveredNodeData {
  nodeId: string;
  transportDetails: ESPTransportConfig;
}

/**
 * Per-event registry of the subscriber callback held on {@link ESPRMNeoUser}.
 * One callback per event — subscribing again for the same event replaces the
 * previous callback rather than appending.
 */
type EventCallbacks = {
  [event in ESPRMNeoEventType | string]?: ESPEventCallback;
};

export {
  ESPDiscoveryProtocol,
  ESPRMNeoEventType,
  DiscoveryParamsInterface,
  ESPLocalDiscoveryAdapterInterface,
  ESPDiscoveredNodeData,
  ESPDiscoveryCallback,
  ESPEventCallback,
  EventCallbacks,
};
