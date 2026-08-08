/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPAPIResponse } from "./output";
import type { ESPRMNeoNode } from "../ESPRMNeoNode";

/**
 * Defines the transport mode for ESP node communication.
 *
 * The transport mode specifies whether communication is done locally (LAN /
 * local-control) or through MQTT (the RainMaker Neo cloud channel: AWS IoT
 * shadow / RainMaker user params topic).
 */
enum ESPTransportMode {
  /** Communication is handled locally over the LAN, without cloud intervention. */
  local = "local",

  /** Communication is routed through MQTT (RainMaker Neo cloud: AWS shadow). */
  mqtt = "mqtt",
}

/**
 * Wire protocol spoken by the `local` transport. Both protocols run over a
 * protocomm session on the node's LAN HTTP server; they differ in endpoint
 * names and message encoding.
 *
 * Carried on the local transport config's `metadata.protocol`, set by local
 * discovery from the mDNS service type that produced the hit.
 */
enum ESPLocalControlProtocol {
  /**
   * RainMaker Neo protocol (`rmaker_local_ctrl/*` session plus
   * `get_params`/`set_params`/`get_config`), advertised as
   * `_esp_rmaker_ctrl._tcp`. Default for this SDK.
   */
  rmakerLocalCtrl = "rmaker_local_ctrl",
}

/**
 * Protocol assumed when a local transport config carries no explicit
 * `metadata.protocol` — for example a LAN transport restored from a client-side
 * registry rather than a fresh discovery hit.
 */
const DEFAULT_LOCAL_CONTROL_PROTOCOL = ESPLocalControlProtocol.rmakerLocalCtrl;

/**
 * Configuration options for the transport mechanism for ESP communication.
 *
 * Includes the transport type and any additional metadata for the chosen mode
 * (e.g. `baseUrl`, `securityType`, `pop`, `protocol` for the local transport).
 */
interface ESPTransportConfig {
  /**
   * Transport mode. One of {@link ESPTransportMode} for built-in transports,
   * or an arbitrary string key for a custom transport registered via
   * `customTransportManagers` on the node.
   */
  type: ESPTransportMode | string;

  /**
   * Additional metadata for the transport configuration.
   *
   * This can include any key-value pairs relevant to the chosen transport mode.
   */
  metadata: Record<string, any>;
}

/**
 * Contract implemented by every transport (built-in or custom). The
 * {@link delegatedTransportHandler} drives a transport purely through this
 * interface, so custom transports (BLE, WebSocket, proprietary) are
 * interchangeable with the built-in local/cloud transports.
 */
interface ESPTransportInterface {
  /**
   * Sets parameters on the node.
   * @param payload - `{ node_id, payload }` where `payload` is the
   *   `{ <deviceOrServiceId>: { <paramId>: value } }` map to apply.
   * @param nodeRef - Optional reference to the node instance (custom transports
   *   may use it to read config/metadata).
   * @returns A promise resolving to the API response.
   */
  setParam(
    payload: Record<string, any>,
    nodeRef?: ESPRMNeoNode
  ): Promise<ESPAPIResponse>;

  /**
   * Gets parameters from the node.
   * @param payload - `{ node_id }` identifying the node to read.
   * @param nodeRef - Optional reference to the node instance.
   * @returns A promise resolving to the node's parameters.
   */
  getParams(
    payload: Record<string, any>,
    nodeRef?: ESPRMNeoNode
  ): Promise<Record<string, any>>;
}

/**
 * Default transport priority order used when neither the node nor the SDK base
 * has an explicit order configured: local control first, MQTT (cloud) fallback.
 */
const DEFAULT_TRANSPORT_ORDER: (ESPTransportMode | string)[] = [
  ESPTransportMode.local,
  ESPTransportMode.mqtt,
];

export {
  ESPTransportMode,
  ESPLocalControlProtocol,
  ESPTransportConfig,
  ESPTransportInterface,
  DEFAULT_TRANSPORT_ORDER,
  DEFAULT_LOCAL_CONTROL_PROTOCOL,
};
