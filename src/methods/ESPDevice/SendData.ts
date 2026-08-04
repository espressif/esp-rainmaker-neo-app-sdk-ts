/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";

/**
 * Augments the ESPDevice class with the `sendData` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Sends data to the device at a specific endpoint.
     *
     * @param endPoint - The endpoint to send data to.
     * @param data - The data string to send.
     * @returns A promise that resolves to the response string from the device.
     * @throws {Error} If sending data fails or the adapter is not configured.
     */
    sendData(endPoint: string, data: string): Promise<string>;
  }
}

ESPDevice.prototype.sendData = async function (
  endPoint: string,
  data: string
): Promise<string> {
  return await this.ESPProvisionAdapter.sendData(this.name, endPoint, data);
};
