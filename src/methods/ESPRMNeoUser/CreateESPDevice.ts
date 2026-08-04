/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPDevice } from "../../ESPDevice";
import { ESPRMNeoBase } from "../../ESPRMNeoBase";
import {
  ESPDeviceInterface,
  ESPSecurity,
  ESPTransport,
} from "../../types/provision";
import { ESPProvError } from "../../utils/error/ESPProvError";
import { ProvErrorCodes } from "../../utils/constants";

/**
 * Augments the ESPRMNeoUser class with the `createESPDevice` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Creates an ESP device with the given parameters.
     * @param name - The name of the device.
     * @param transport - The transport type to use.
     * @param security - The security type to use (optional).
     * @param proofOfPossession - The proof of possession string (optional).
     * @param softAPPassword - The SoftAP password (optional).
     * @param username - The username (optional).
     * @returns A promise that resolves to an ESPDevice instance.
     */
    createESPDevice(
      name: string,
      transport: ESPTransport,
      security?: ESPSecurity,
      proofOfPossession?: string,
      softAPPassword?: string,
      username?: string
    ): Promise<ESPDevice>;
  }
}

/**
 * Creates an ESP device with the given parameters.
 * @param name - The name of the device.
 * @param transport - The transport type to use.
 * @param security - The security type to use (optional).
 * @param proofOfPossession - The proof of possession string (optional).
 * @param softAPPassword - The SoftAP password (optional).
 * @param username - The username (optional).
 * @returns A promise that resolves to an ESPDevice instance.
 */
ESPRMNeoUser.prototype.createESPDevice = async function (
  name: string,
  transport: ESPTransport,
  security?: ESPSecurity,
  proofOfPossession?: string,
  softAPPassword?: string,
  username?: string
): Promise<ESPDevice> {
  const provisionAdapter = ESPRMNeoBase.getProvisionAdapter();
  if (!provisionAdapter) {
    throw new ESPProvError(ProvErrorCodes.MISSING_PROV_ADAPTER);
  }
  const espDevice: ESPDeviceInterface = await provisionAdapter.createESPDevice(
    name,
    transport,
    security,
    proofOfPossession,
    softAPPassword,
    username
  );
  return new ESPDevice(espDevice);
};
