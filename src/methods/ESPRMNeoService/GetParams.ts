/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoService } from "../../ESPRMNeoService";
import type { ESPRMNeoServiceParam } from "../../ESPRMNeoServiceParam";
import { delegatedTransportHandler } from "../../services/ESPRMNeoHelpers/DelegatedTransportHandler";
import { applyValuesToParams } from "../../utils/paramValues";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { Logger } from "../../utils/logger";

const logger = new Logger("ServiceGetParams");

/**
 * Augments the ESPRMNeoService class with the `getParams` method.
 */
declare module "../../ESPRMNeoService" {
  interface ESPRMNeoService {
    /**
     * Fetches live param values for this service via the best available
     * transport (local control first when reachable, otherwise MQTT) and
     * updates each {@link ESPRMNeoServiceParam}'s `value`. Returns the same
     * instances as {@link ESPRMNeoService.params}.
     *
     * @throws If the parent node reference has been garbage collected.
     */
    getParams(): Promise<ESPRMNeoServiceParam[]>;
  }
}

ESPRMNeoService.prototype.getParams = async function (): Promise<ESPRMNeoServiceParam[]> {
  logger.debug("getParams called", { service: this.name });
  const node = this._nodeRef.deref();

  if (!node) {
    logger.error("getParams failed: missing node ref", { service: this.name });
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_NODE_REF
    );
  }

  try {
    const allParams = await (delegatedTransportHandler<Record<string, any>>).call(
      node,
      (manager) => manager.getParams({ node_id: node.nodeId }, node)
    );

    applyValuesToParams(this.params, allParams[this.name]);

    logger.debug("getParams succeeded", {
      service: this.name,
      nodeId: node.nodeId,
      count: this.params.length,
    });

    return this.params;
  } catch (error) {
    logger.error("getParams failed", {
      service: this.name,
      nodeId: node.nodeId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
