/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ConnectOptions,
  ConnectResult,
  DiscoveredDevice,
  ProvisionAdapter,
  ProvisionConfig,
  ProvisionResult,
  ScanOptions,
} from "./ProvisionAdapter";

/**
 * Reference in-memory implementation of {@link ProvisionAdapter}.
 *
 * It satisfies the adapter contract without any native dependency, so it can be
 * used as: (a) the proof the contract suite is correct, and (b) a drop-in fake
 * for higher-level SDK tests that need provisioning to "work" deterministically.
 * Native adapters should pass the exact same contract suite.
 */
export class MockProvisionAdapter implements ProvisionAdapter {
  private readonly catalog: DiscoveredDevice[];
  private connectedDeviceId: string | null = null;

  constructor(catalog?: DiscoveredDevice[]) {
    this.catalog = catalog ?? [
      { id: "PROV_1234", name: "PROV_1234", transport: "ble", rssi: -52 },
      { id: "PROV_5678", name: "PROV_5678", transport: "softap", rssi: -67 },
      { id: "OTHER_9999", name: "OTHER_9999", transport: "ble", rssi: -80 },
    ];
  }

  async scan(options?: ScanOptions): Promise<DiscoveredDevice[]> {
    const prefix = options?.prefix;
    const devices = prefix
      ? this.catalog.filter((d) => d.name.startsWith(prefix))
      : [...this.catalog];
    return devices.map((d) => ({ ...d }));
  }

  async connect(
    deviceId: string,
    options?: ConnectOptions
  ): Promise<ConnectResult> {
    const device = this.catalog.find((d) => d.id === deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }
    if (options?.proofOfPossession === "") {
      throw new Error("proofOfPossession must not be empty when provided");
    }
    this.connectedDeviceId = deviceId;
    return { connected: true, deviceId };
  }

  async provision(config: ProvisionConfig): Promise<ProvisionResult> {
    if (!this.connectedDeviceId) {
      throw new Error("Not connected: call connect() before provision()");
    }
    if (!config.ssid || config.ssid.trim() === "") {
      throw new Error("ssid is required");
    }
    return {
      success: true,
      nodeId: `node-${this.connectedDeviceId}`,
      message: "Provisioned",
    };
  }

  async disconnect(): Promise<void> {
    this.connectedDeviceId = null;
  }
}
