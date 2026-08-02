/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoDevice } from "../../ESPRMNeoDevice";
import type { ESPRMNeoDeviceParam } from "../../ESPRMNeoDeviceParam";
import { delegatedTransportHandler } from "../../services/ESPRMNeoHelpers/DelegatedTransportHandler";
import { applyValuesToParams } from "../../utils/paramValues";
import { readLocalNodeConfig } from "../../utils/nodeUtils";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Options accepted by {@link ESPRMNeoDevice.getParams}.
 */
export interface GetDeviceParamsOptions {
  /**
   * Whether to use the local node-config cache for param values.
   *
   * - `true` (default): read this device's values from the cached node config
   *   in local storage (when present) and apply them onto
   *   {@link ESPRMNeoDevice.params}.
   * - `false`: fetch live values via the best available transport (local
   *   control first when reachable, otherwise MQTT) and update each
   *   {@link ESPRMNeoDeviceParam}'s `value`.
   *
   * @defaultValue true
   */
  cache?: boolean;
  /** Optional transport timeout in milliseconds (used when `cache` is `false`). */
  timeout?: number;
}

/**
 * Augments the ESPRMNeoDevice class with the `getParams` method.
 */
declare module "../../ESPRMNeoDevice" {
  interface ESPRMNeoDevice {
    /**
     * Returns param values for this device.
     *
     * With `cache: true` (default), reads values from the local node-config
     * cache when present and applies them onto {@link ESPRMNeoDevice.params}.
     * With `cache: false`, fetches live values via the best available transport
     * (local control first when reachable, otherwise MQTT) and updates each
     * {@link ESPRMNeoDeviceParam}'s `value`. Returns the same instances as
     * {@link ESPRMNeoDevice.params}.
     *
     * @param options - See {@link GetDeviceParamsOptions}. Defaults to `{ cache: true }`.
     */
    getParams(options?: GetDeviceParamsOptions): Promise<ESPRMNeoDeviceParam[]>;
  }
}

ESPRMNeoDevice.prototype.getParams = async function (
  options?: GetDeviceParamsOptions
): Promise<ESPRMNeoDeviceParam[]> {
  const self = this as ESPRMNeoDevice;
  const useCache = options?.cache ?? true;

  const node = self._nodeRef.deref();
  if (!node) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_NODE_REF
    );
  }

  if (useCache) {
    const local = await readLocalNodeConfig(node.nodeId);
    const cachedParams = local?.params as
      | Record<string, unknown>
      | undefined;
    if (cachedParams?.[self.name] !== undefined) {
      applyValuesToParams(self.params, cachedParams[self.name]);
    }
    return self.params;
  }

  const allParams = await (delegatedTransportHandler<Record<string, any>>).call(
    node,
    (manager) => manager.getParams({ node_id: node.nodeId }, node)
  );
  applyValuesToParams(self.params, allParams[self.name]);
  return self.params;
};
