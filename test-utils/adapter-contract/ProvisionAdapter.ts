/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Contract for a device-provisioning adapter.
 *
 * Native platforms (Android, iOS) and the web each provide their own
 * implementation of this interface; the SDK calls it the same way regardless.
 * Because the behaviour must be identical across platforms, the SAME test suite
 * (`runProvisionAdapterContract`) is run against every implementation — that is
 * what "adapter contract testing" means here. This file is deliberately free of
 * any OpenAPI/backend concern; it models the native capability surface only.
 */

/** Transport a device was discovered on. */
export type ProvisionTransport = "ble" | "softap";

export interface DiscoveredDevice {
  /** Stable identifier used to `connect()`. */
  id: string;
  /** Human-readable advertised name. */
  name: string;
  transport: ProvisionTransport;
  /** Signal strength, when the platform exposes it. */
  rssi?: number;
}

export interface ScanOptions {
  /** Only return devices whose name starts with this prefix. */
  prefix?: string;
  /** Abort the scan after this many milliseconds. */
  timeoutMs?: number;
}

export interface ConnectOptions {
  /** Proof-of-possession / PIN required by the device security scheme. */
  proofOfPossession?: string;
}

export interface ConnectResult {
  connected: boolean;
  deviceId: string;
}

export interface ProvisionConfig {
  /** Target Wi-Fi SSID to hand to the device. */
  ssid: string;
  passphrase?: string;
}

export interface ProvisionResult {
  success: boolean;
  /** Cloud node id assigned to the provisioned device, on success. */
  nodeId?: string;
  message?: string;
}

/**
 * The native provisioning capability. Lifecycle: `scan` -> `connect` ->
 * `provision` -> `disconnect`.
 */
export interface ProvisionAdapter {
  /** Discover provisionable devices over BLE/SoftAP. */
  scan(options?: ScanOptions): Promise<DiscoveredDevice[]>;
  /** Establish a secure session with a previously discovered device. */
  connect(deviceId: string, options?: ConnectOptions): Promise<ConnectResult>;
  /** Send network credentials to the connected device. */
  provision(config: ProvisionConfig): Promise<ProvisionResult>;
  /** Tear down the device session. */
  disconnect(): Promise<void>;
}
