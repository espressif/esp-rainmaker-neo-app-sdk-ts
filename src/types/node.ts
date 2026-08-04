/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESP RainMaker Neo Node type definitions.
 *
 * Hierarchy:
 * ESPRMNeoNode
 *   ├── ESPRMNeoDevice[] (logical devices)
 *   │     └── ESPRMNeoDeviceParam[] (device params)
 *   └── ESPRMNeoService[] (node services, optional)
 *         └── ESPRMNeoServiceParam[] (service params)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Base interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base attribute interface (name, value).
 */
export interface ESPRMNeoAttributeInterface {
  name: string;
  value?: unknown;
}

/**
 * Base param interface for device and service params.
 */
export interface ESPRMNeoParamInterface {
  id: string;
  value?: any;
  type: string;
  properties: string[];
  dataType: string;
  bounds?: Record<string, unknown>;
  validStrings?: string[];
}

/**
 * Device parameter – one controllable parameter of a device (e.g. Power, Brightness).
 */
export interface ESPRMNeoDeviceParamInterface extends ESPRMNeoParamInterface {
  deviceName: string;
  uiType?: string;
}

/**
 * Service parameter – one parameter of a node service (e.g. timezone).
 */
export interface ESPRMNeoServiceParamInterface extends ESPRMNeoParamInterface {
  serviceName: string;
}

/**
 * Logical device inside a node (e.g. switch, light, thermostat).
 */
export interface ESPRMNeoDeviceInterface {
  name: string;
  displayName: string;
  type: string;
  attributes?: ESPRMNeoAttributeInterface[];
  params?: ESPRMNeoDeviceParamInterface[];
  primaryParam?: ESPRMNeoDeviceParamInterface;
}

/**
 * Node-level service (not tied to a single device), e.g. time, local control.
 */
export interface ESPRMNeoServiceInterface {
  name: string;
  type: string;
  params: ESPRMNeoServiceParamInterface[];
  value?: any
}

/**
 * Node info (model, firmware, etc.).
 */
export interface ESPRMNeoNodeInfoInterface {
  name?: string;
  type: string;
  model: string;
  firmwareVersion?: string;
  readme?: string;
  [key: string]: unknown;
}

/**
 * Plain-object view of a node's devices, services, and metadata (e.g. from API transforms).
 * For live instances, use the `ESPRMNeoNode` class.
 */
export interface ESPRMNeoNodeData {
  configVersion?: string;
  attributes?: ESPRMNeoAttributeInterface[];
  devices: ESPRMNeoDeviceInterface[];
  info?: ESPRMNeoNodeInfoInterface;
  services?: ESPRMNeoServiceInterface[];
}

/**
 * Connectivity status for a node.
 */
export interface ESPRMNeoConnectivityStatusInterface {
  isConnected: boolean;
  lastConnectionTimestamp: number;
}

/**
 * `state.reported` fields the SDK reads from an AWS IoT device shadow.
 * Partials are common (e.g. only `ncfg_ver` or only a param subset).
 */
export interface ESPRMNeoShadowReported {
  online?: boolean;
  params?: Record<string, unknown>;
  ncfg_ver?: string | number;
  disconnect_info?: {
    last_disconnect_ts?: number;
  };
}

/**
 * Shadow `state` object (`reported` + optional `desired`).
 */
export interface ESPRMNeoShadowState {
  reported?: ESPRMNeoShadowReported;
  desired?: unknown;
}

/**
 * AWS IoT shadow document shape used for live MQTT updates and GET responses.
 */
export interface ESPRMNeoShadowDocument {
  state?: ESPRMNeoShadowState;
}

/**
 * Params and connectivity derived from a shadow / reported-state payload.
 */
export interface ESPRMNeoExtractedShadow {
  params: Record<string, unknown>;
  connectivityStatus: ESPRMNeoConnectivityStatusInterface;
  configVersion: string;
}

/**
 * Node interface – represents a claimed RainMaker Neo node.
 */
export interface ESPRMNeoNodeInterface {
  id: string;
  nodeId: string;
  groupId: string;
  subgroupId?: string;
  nodeData?: ESPRMNeoNodeData;
  connectivityStatus?: ESPRMNeoConnectivityStatusInterface;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw API response interfaces (snake_case)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw API attribute (snake_case).
 */
export interface ESPRMNeoAttributeAPI {
  name?: string;
  value?: unknown;
}

/**
 * Raw API param (snake_case).
 */
export interface ESPRMNeoParamAPI {
  data_type: string;
  id: string;
  properties: string[];
  type?: string;
  ui_type?: string;
  bounds?: { max: number; min: number };
  valid_strings?: string[];
}

/**
 * Raw API node config `info` block (snake_case). Mirrors the backend's
 * `NodeCfgInfo` struct (rmneo `src/service/config/config.go`), where
 * `fw_version` is the only required field on the wire. The config is stored
 * and served verbatim by the backend, so extra keys may pass through.
 */
export interface ESPRMNeoNodeInfoAPI {
  fw_version: string;
  type?: string;
  model?: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Raw API device (snake_case).
 */
export interface ESPRMNeoDeviceAPI {
  id: string;
  params: ESPRMNeoParamAPI[];
  primary: string;
  type?: string;
  attributes?: ESPRMNeoAttributeAPI[];
}

/**
 * Raw API service (snake_case).
 */
export interface ESPRMNeoServiceAPI {
  id: string;
  type?: string;
  params?: ESPRMNeoParamAPI[];
}

/**
 * Raw API node config response (snake_case).
 */
export interface ESPRMNeoNodeConfigAPI {
  node_id: string;
  config: {
    devices: ESPRMNeoDeviceAPI[];
    config_version?: string;
    info?: ESPRMNeoNodeInfoAPI;
    services?: ESPRMNeoServiceAPI[];
  };
}
