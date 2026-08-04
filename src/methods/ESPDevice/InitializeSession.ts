/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";

/**
 * Augments the ESPDevice class with the `initializeSession` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Initializes a provisioning session with the device.
     *
     * @returns A promise that resolves to `true` if session initialization was successful.
     * @throws {Error} If session initialization fails or the adapter is not configured.
     */
    initializeSession(): Promise<boolean>;
  }
}

ESPDevice.prototype.initializeSession = async function (): Promise<boolean> {
  return await this.ESPProvisionAdapter.initializeSession(this.name);
};
