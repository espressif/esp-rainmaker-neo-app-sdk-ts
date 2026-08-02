/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";

/**
 * Augments the ESPDevice class with the `connect` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Connects to the ESP device using the configured provisioning adapter.
     *
     * @returns A promise that resolves to a connection status code (0 for success).
     * @throws {Error} If the device cannot be connected or the adapter is not configured.
     */
    connect(): Promise<number>;
  }
}

ESPDevice.prototype.connect = async function (): Promise<number> {
  return await this.ESPProvisionAdapter.connect(this.name);
};
