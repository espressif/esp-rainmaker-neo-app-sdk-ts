/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPDevice } from "../../ESPDevice";
import { ESPRMNeoBase } from "../../ESPRMNeoBase";
import { ESPDeviceInterface, ESPTransport } from "../../types/provision";
import { ESPProvError } from "../../utils/error/ESPProvError";
import { ProvErrorCodes } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("SearchESPDevices");

/**
 * Augments the ESPRMNeoUser class with the `searchESPDevices` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Searches for ESP devices with the given prefix.
     * @param devicePrefix - The prefix of the device name to search for.
     * @param transport - The transport type (BLE or SoftAP).
     * @returns A promise that resolves to an array of ESPDevice instances.
     */
    searchESPDevices(
      devicePrefix: string,
      transport: ESPTransport
    ): Promise<ESPDevice[]>;
  }
}

/**
 * Searches for ESP devices with the given prefix.
 * @param devicePrefix - The prefix of the device name to search for.
 * @param transport - The transport type (BLE or SoftAP).
 * @returns A promise that resolves to an array of ESPDevice instances.
 */
ESPRMNeoUser.prototype.searchESPDevices = async function (
  devicePrefix: string,
  transport: ESPTransport
): Promise<ESPDevice[]> {
  logger.debug("searchESPDevices called", { devicePrefix, transport });
  const provisionAdapter = ESPRMNeoBase.getProvisionAdapter();
  if (!provisionAdapter) {
    logger.error("searchESPDevices failed", {
      error: "MISSING_PROV_ADAPTER",
    });
    throw new ESPProvError(ProvErrorCodes.MISSING_PROV_ADAPTER);
  }

  try {
    const espDevices = await provisionAdapter.searchESPDevices(
      devicePrefix,
      transport
    );

    const devices = espDevices?.map(
      (espDevice: ESPDeviceInterface) => new ESPDevice(espDevice)
    );

    logger.debug("searchESPDevices succeeded", {
      devicePrefix,
      transport,
      count: devices?.length ?? 0,
    });
    return devices;
  } catch (error) {
    logger.error("searchESPDevices failed", {
      devicePrefix,
      transport,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
