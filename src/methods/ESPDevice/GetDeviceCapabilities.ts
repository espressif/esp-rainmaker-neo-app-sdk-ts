/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";

/**
 * Augments the ESPDevice class with the `getDeviceCapabilities` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Retrieves the capabilities of the device.
     *
     * @returns A promise that resolves to an array of capability strings.
     * @throws {Error} If the capabilities cannot be retrieved or the adapter is not configured.
     */
    getDeviceCapabilities(): Promise<string[]>;
  }
}

ESPDevice.prototype.getDeviceCapabilities = async function (): Promise<
  string[]
> {
  return await this.ESPProvisionAdapter.getDeviceCapabilities(this.name);
};
