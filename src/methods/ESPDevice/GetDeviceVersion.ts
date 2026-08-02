/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";

/**
 * Augments the ESPDevice class with the `getDeviceVersion` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Retrieves version information from the device.
     *
     * @returns A promise that resolves to an object containing device version information.
     * @throws {Error} If the version cannot be retrieved or the adapter is not configured.
     */
    getDeviceVersion(): Promise<{ [key: string]: any }>;
  }
}

ESPDevice.prototype.getDeviceVersion = async function (): Promise<{
  [key: string]: any;
}> {
  return await this.ESPProvisionAdapter.getDeviceVersion(this.name);
};
