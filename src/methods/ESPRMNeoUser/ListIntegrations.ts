/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPSigV4APIManager } from "../../services/ESPSigV4APIManager";
import { IntegrationInfo } from "../../types/output";
import { APIPathV1 } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("ListIntegrations");

/**
 * Augments the ESPRMNeoUser class with the `listIntegrations` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Lists the configured integrations available to the calling user
     * (SigV4-signed GET `/v1/integrations`). This is the non-admin counterpart
     * of the admin listing and exposes only `integration_id` / `integration_type`
     * — no credentials or other configuration.
     *
     * Use the returned `integration_id` when registering a delivery endpoint via
     * {@link ESPRMNeoUser.registerIntegrationEndpoint}.
     *
     * @returns A promise that resolves to the list of configured integrations.
     */
    listIntegrations(): Promise<IntegrationInfo[]>;
  }
}

/** Wrapper for the list-integrations response; server may return an array or `{ integrations }`. */
type ListIntegrationsResponse =
  | IntegrationInfo[]
  | { integrations?: IntegrationInfo[] };

/**
 * Implementation of the `listIntegrations` method for the `ESPRMNeoUser` class.
 */
ESPRMNeoUser.prototype.listIntegrations = async function (): Promise<
  IntegrationInfo[]
> {
  logger.debug("listIntegrations called");
  try {
    const api = ESPSigV4APIManager.getInstance();
    const response = await api.get<ListIntegrationsResponse>(
      APIPathV1.INTEGRATIONS
    );

    const integrations = Array.isArray(response)
      ? response
      : (response?.integrations ?? []);

    logger.debug("listIntegrations succeeded", {
      count: integrations.length,
    });
    return integrations;
  } catch (error) {
    logger.error("listIntegrations failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
