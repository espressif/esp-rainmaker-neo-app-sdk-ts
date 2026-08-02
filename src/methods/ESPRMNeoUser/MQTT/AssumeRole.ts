/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../../ESPRMNeoUser";
import { AWSCredentials } from "../../../types/input";
import {
  APIPathV1,
  AssumeRoleErrorMessages,
} from "../../../utils/constants";
import { ESPSigV4APIManager } from "../../../services/ESPSigV4APIManager";

/**
 * Augments the ESPRMNeoUser class with the `assumeRole` method.
 */
declare module "../../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Exchanges identity (temporary) credentials for role-based credentials.
     *
     * Two modes — chosen by whether `options.services` is set:
     *   1. Default (no `options.services`): POST /v1/assumed-roles. Returns
     *      IoT/MQTT credentials scoped to the user's group/subgroup membership.
     *      Used for MQTT WebSocket auth.
     *   2. Per-node services (`options.services` with `nodeId`):
     *      Same route, with `services` and `node_id` in the body. Returns
     *      credentials scoped to that single node for the listed services
     *      (currently `s3` and/or `kvs`). The response contains only the
     *      requested service permissions — no IoT/MQTT statements.
     *
     * @param accessKey - AWS access key from getTemporaryAWSCredentials.
     * @param secretKey - AWS secret key from getTemporaryAWSCredentials.
     * @param sessionToken - AWS session token from getTemporaryAWSCredentials.
     * @param options - Optional. To request per-node service credentials, pass
     *                  `services` and `nodeId`.
     * @returns A promise that resolves to AWSCredentials.
     * @throws Error if `services` is set without `nodeId`, or if the API call fails.
     */
    assumeRole(
      accessKey: string,
      secretKey: string,
      sessionToken: string,
      options?: AssumeRoleOptions
    ): Promise<AWSCredentials>;
  }
}

/** Per-node service credentials supported by the backend. */
export type AssumeRoleService = "s3" | "kvs";

/** Options for the assumeRole method. */
export interface AssumeRoleOptions {
  /**
   * Services to scope credentials to (e.g., `["s3"]`, `["kvs"]`, `["s3", "kvs"]`).
   * When set, `nodeId` is required and the returned credentials contain only the
   * listed service permissions for that single node.
   */
  services?: AssumeRoleService[];
  /** Required when `services` is set. The node these credentials apply to. */
  nodeId?: string;
}

/**
 * Implementation of the `assumeRole` method for the `ESPRMNeoUser` class.
 */
ESPRMNeoUser.prototype.assumeRole = async function (
  accessKey: string,
  secretKey: string,
  sessionToken: string,
  options?: AssumeRoleOptions
): Promise<AWSCredentials> {
  const requestBody: Record<string, any> = {
    access_key: accessKey,
    secret_key: secretKey,
    session_token: sessionToken,
  };

  const servicesMode = !!(options?.services && options.services.length > 0);

  if (servicesMode) {
    if (!options!.nodeId) {
      throw new Error(AssumeRoleErrorMessages.NODE_ID_REQUIRED);
    }
    requestBody.services = options!.services;
    requestBody.node_id = options!.nodeId;
  }

  const api = ESPSigV4APIManager.getInstance();
  const response = await api.post<AWSCredentials>(
    APIPathV1.ASSUME_ROLE,
    requestBody
  );

  // Validate response contains required fields
  if (!response.access_key || !response.secret_key || !response.session_token) {
    throw new Error(AssumeRoleErrorMessages.INVALID_RESPONSE);
  }

  return response;
};
