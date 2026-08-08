/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ESPDeviceInterface,
  ESPProvisionAdapterInterface,
} from "./types/provision";
// Lazy require to avoid circular dependency: ESPDevice -> ESPRMNeoBase -> (index) -> ESPDevice
function getESPRMNeoBase() {
  return require("./ESPRMNeoBase").ESPRMNeoBase;
}

/**
 * Represents an ESP device for provisioning and local communication.
 * Provides methods for device discovery and WiFi provisioning.
 */
export class ESPDevice implements ESPDeviceInterface {
  private _espProvisionAdapter?: ESPProvisionAdapterInterface;

  get ESPProvisionAdapter(): ESPProvisionAdapterInterface {
    if (!this._espProvisionAdapter) {
      this._espProvisionAdapter = getESPRMNeoBase().getProvisionAdapter();
    }
    return this._espProvisionAdapter!;
  }

  name: string;
  transport: string;
  security: number;

  /**
   * What a completed association produced, kept so `retryNetworkCredentials`
   * can resume the flow instead of repeating it. Set once verification
   * succeeds; `undefined` until then.
   */
  provisionResumeState?: {
    nodeId: string;
    groupId: string;
    options?: Record<string, any>;
  };

  constructor(deviceConfig: ESPDeviceInterface) {
    this.name = deviceConfig.name;
    this.transport = deviceConfig.transport;
    this.security = deviceConfig.security;
  }
}
