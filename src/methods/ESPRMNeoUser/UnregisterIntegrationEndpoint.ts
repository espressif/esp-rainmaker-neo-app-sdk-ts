/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { SuccessResponse } from "../../types/output";
import { APIPathV1, IntegrationSuccessMessages } from "../../utils/constants";
import { Logger } from "../../utils/logger";
import { normalizeApiResponse } from "../../utils/normalizeApiResponse";

const logger = new Logger("UnregisterIntegrationEndpoint");

/**
 * Augments the ESPRMNeoUser class with the `unregisterIntegrationEndpoint` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Unregisters one specific delivery endpoint for the calling user on the given
     * integration (SigV4-signed DELETE
     * `/v1/integrations/{integrationId}/endpoints/{endpointId}`), cleaning up the
     * underlying delivery registration.
     *
     * @param integrationId - Integration the endpoint was registered on.
     * @param endpointId - The `endpoint_id` returned by {@link ESPRMNeoUser.registerIntegrationEndpoint}.
     * @returns API success payload (optional `{ message }` on success).
     */
    unregisterIntegrationEndpoint(
      integrationId: string,
      endpointId: string
    ): Promise<SuccessResponse>;
  }
}

/**
 * Implementation of the `unregisterIntegrationEndpoint` method for the `ESPRMNeoUser` class.
 */
ESPRMNeoUser.prototype.unregisterIntegrationEndpoint = async function (
  integrationId: string,
  endpointId: string
): Promise<SuccessResponse> {
  logger.debug("unregisterIntegrationEndpoint called", {
    integrationId,
    endpointId,
  });
  const api = ESPSigV4APIManager.getInstance();
  const endpoint = APIPathV1.integrationEndpoint(integrationId, endpointId);

  try {
    const response = await api.delete<SuccessResponse>(endpoint);
    logger.debug("unregisterIntegrationEndpoint succeeded", {
      integrationId,
      endpointId,
    });
    return normalizeApiResponse(response, {
      message: IntegrationSuccessMessages.ENDPOINT_UNREGISTERED,
    });
  } catch (error) {
    logger.error("unregisterIntegrationEndpoint failed", {
      integrationId,
      endpointId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
