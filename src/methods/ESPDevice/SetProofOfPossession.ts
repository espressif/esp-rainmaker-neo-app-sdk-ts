/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";

/**
 * Augments the ESPDevice class with the `setProofOfPossession` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Sets the proof of possession (PoP) for the device during provisioning.
     *
     * @param proofOfPossession - The proof of possession string.
     * @returns A promise that resolves to `true` if PoP was set successfully.
     * @throws {Error} If setting PoP fails or the adapter is not configured.
     */
    setProofOfPossession(proofOfPossession: string): Promise<boolean>;
  }
}

ESPDevice.prototype.setProofOfPossession = async function (
  proofOfPossession: string
): Promise<boolean> {
  return await this.ESPProvisionAdapter.setProofOfPossession(
    this.name,
    proofOfPossession
  );
};
