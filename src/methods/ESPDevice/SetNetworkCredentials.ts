/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import { ESPProvisionStatus } from "../../types/provision";

/**
 * Augments the ESPDevice class with the `setNetworkCredentials` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Sets the network credentials for the device.
     * @param ssid - The SSID of the Wi-Fi network.
     * @param passphrase - The passphrase of the Wi-Fi network.
     * @returns A promise that resolves to the provisioning status.
     */
    setNetworkCredentials(
      ssid: string,
      passphrase: string
    ): Promise<ESPProvisionStatus>;
  }
}

ESPDevice.prototype.setNetworkCredentials = async function (
  ssid: string,
  passphrase: string
): Promise<ESPProvisionStatus> {
  return this.ESPProvisionAdapter.provision(this.name, ssid, passphrase);
};
