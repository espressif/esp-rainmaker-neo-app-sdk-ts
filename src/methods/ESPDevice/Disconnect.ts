/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import { ESPAPIResponse } from "../../types/output";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

/**
 * Augments the ESPDevice class with the `disconnect` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Disconnects from the ESP device.
     *
     * @returns A promise that resolves with the API response when disconnection is complete.
     * @throws {Error} If disconnection fails or the adapter is not configured.
     */
    disconnect(): Promise<ESPAPIResponse>;
  }
}

ESPDevice.prototype.disconnect = async function (): Promise<ESPAPIResponse> {
  await this.ESPProvisionAdapter.disconnect(this.name);
  return normalizeApiResponse(null, { message: "Device disconnected successfully" });
};
