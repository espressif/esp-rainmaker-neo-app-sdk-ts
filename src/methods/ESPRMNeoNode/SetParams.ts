/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPAPIResponse } from "../../types/output";
import { delegatedTransportHandler } from "../../services/ESPRMNeoHelpers/DelegatedTransportHandler";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

/**
 * Augments the ESPRMNeoNode class with the `setParams` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Publishes a parameter update to this node via the best available
     * transport (local control first when reachable, otherwise MQTT).
     *
     * The returned response indicates the publish was accepted by the
     * transport (local ack or MQTT publish resolved). It does **not**
     * guarantee that the device received or applied the params — cloud
     * publishes are fire-and-forget over AWS IoT.
     *
     * @param params - A record of device/service names to param maps.
     * @returns A promise that resolves once the transport publish is accepted.
     * @throws {ESPAPICallValidationError} If `params` is empty.
     * @throws If all available transports fail.
     */
    setParams(params: Record<string, any>): Promise<ESPAPIResponse>;
  }
}

ESPRMNeoNode.prototype.setParams = async function (
  params: Record<string, any>
): Promise<ESPAPIResponse> {
  if (!params || Object.keys(params).length === 0) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_PARAMS
    );
  }
  const payload = { node_id: this.nodeId, payload: params };
  return (delegatedTransportHandler<ESPAPIResponse>).call(this, (manager) =>
    manager.setParam(payload, this)
  );
};
