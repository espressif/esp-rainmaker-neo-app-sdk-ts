/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import { Logger } from "../../utils/logger";

const logger = new Logger("ResetWifiStatus");

/**
 * Augments the ESPDevice class with the `resetWifiStatus` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Asks the device to clear its Wi-Fi state over the open provisioning session.
     *
     * Sent on the network-control endpoint, so it needs an established session and
     * leaves the user-node association intact — only Wi-Fi credentials are cleared.
     * That is what makes `retryNetworkCredentials` possible after a wrong password,
     * instead of making the user factory reset the board.
     * @returns A promise resolving to `true` when the device acknowledged the reset.
     */
    resetWifiStatus(): Promise<boolean>;
  }
}

ESPDevice.prototype.resetWifiStatus = async function (): Promise<boolean> {
  if (!this.ESPProvisionAdapter.resetWifiStatus) {
    logger.warn(
      `Adapter has no resetWifiStatus; treating as not acknowledged for "${this.name}"`
    );
    return false;
  }

  try {
    const acknowledged = await this.ESPProvisionAdapter.resetWifiStatus(
      this.name
    );
    return acknowledged;
  } catch (error) {
    logger.error(`<- device "${this.name}": reset failed`, error);
    throw error;
  }
};
