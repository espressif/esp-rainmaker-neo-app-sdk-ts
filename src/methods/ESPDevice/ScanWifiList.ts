/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import { ESPWifiList } from "../../types/provision";

/**
 * Augments the ESPDevice class with the `scanWifiList` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Scans for available WiFi networks using the device's provisioning adapter.
     *
     * @returns A promise that resolves to an array of available WiFi networks.
     * @throws {Error} If the scan fails or the adapter is not configured.
     */
    scanWifiList(): Promise<ESPWifiList[]>;
  }
}

ESPDevice.prototype.scanWifiList = async function (): Promise<ESPWifiList[]> {
  return await this.ESPProvisionAdapter.scanWifiList(this.name);
};
