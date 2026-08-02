/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { RegisterEndpointRequest } from "../../types/input";
import { APIPathV1 } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("RegisterIntegrationEndpoint");

/**
 * Augments the ESPRMNeoUser class with the `registerIntegrationEndpoint` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Registers a delivery endpoint for the calling user on the given integration
     * (SigV4-signed PUT `/v1/integrations/{integrationId}/endpoints`). The server
     * derives an `endpoint_id` per integration type and returns it.
     *
     * Callers must persist the returned `endpoint_id` to later address the endpoint
     * (e.g. for {@link ESPRMNeoUser.unregisterIntegrationEndpoint}).
     *
     * @param integrationId - Target integration id (from {@link ESPRMNeoUser.listIntegrations}).
     * @param appToken - Delivery credential (`delivery_credentials.app_token`), e.g. the push token.
     * @param locale - Optional locale (e.g. `en_US`).
     * @returns The `endpoint_id` derived and returned by the server.
     */
    registerIntegrationEndpoint(
      integrationId: string,
      appToken: string,
      locale?: string
    ): Promise<string>;
  }
}

interface RegisterEndpointResponse {
  endpoint_id: string;
}

/**
 * Implementation of the `registerIntegrationEndpoint` method for the `ESPRMNeoUser` class.
 */
ESPRMNeoUser.prototype.registerIntegrationEndpoint = async function (
  integrationId: string,
  appToken: string,
  locale?: string
): Promise<string> {
  logger.debug("registerIntegrationEndpoint called", { integrationId, locale });
  const api = ESPSigV4APIManager.getInstance();
  const endpoint = APIPathV1.integrationEndpoints(integrationId);
  const requestBody: RegisterEndpointRequest = {
    delivery_credentials: { app_token: appToken },
    ...(locale !== undefined ? { locale } : {}),
  };

  try {
    const response = await api.put<RegisterEndpointResponse>(
      endpoint,
      requestBody
    );
    logger.debug("registerIntegrationEndpoint succeeded", {
      integrationId,
      endpointId: response.endpoint_id,
    });
    return response.endpoint_id;
  } catch (error) {
    logger.error("registerIntegrationEndpoint failed", {
      integrationId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
