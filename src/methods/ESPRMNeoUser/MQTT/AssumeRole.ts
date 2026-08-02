/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../../ESPRMNeoUser";
import { AWSCredentials } from "../../../types/input";
import { APIPathV1 } from "../../../utils/constants";
import { ESPSigV4APIManager } from "../../../services/ESPSigV4APIManager";

/**
 * Augments the ESPRMNeoUser class with the `assumeRole` method.
 */
declare module "../../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Exchanges identity (temporary) credentials for role-based IoT/MQTT credentials.
     *
     * This is not session extension. The backend uses the provided temporary credentials
     * (from getTemporaryAWSCredentials, which are identity-pool–style credentials) to assume
     * an IAM role that has IoT/MQTT permissions. It returns a different set of credentials
     * (assume-role credentials) used for MQTT connection and device shadows.
     *
     * Flow: temporary credentials (auth) → POST /v1/assumed-roles → assume-role credentials (IoT).
     *
     * @param accessKey - AWS access key from getTemporaryAWSCredentials (identity credentials).
     * @param secretKey - AWS secret key from getTemporaryAWSCredentials.
     * @param sessionToken - AWS session token from getTemporaryAWSCredentials.
     * @param options - Optional parameters merged into the request body.
     * @param options.include - Services to include in the session policy (e.g., ["s3"], ["kvs"], ["s3", "kvs"]).
     *                          When omitted, only IoT/MQTT permissions are granted.
     * @returns A promise that resolves to AWSCredentials (role-based; used for MQTT).
     * @throws Error if the API call fails or if the response is invalid.
     */
    assumeRole(
      accessKey: string,
      secretKey: string,
      sessionToken: string,
      options?: AssumeRoleOptions
    ): Promise<AWSCredentials>;
  }
}

/** Options for the assumeRole method. */
export interface AssumeRoleOptions {
  /** Services to include in the session policy (e.g., ["s3"], ["kvs"]). */
  include?: string[];
}

/**
 * Implementation of the `assumeRole` method for the `ESPRMNeoUser` class.
 *
 * Exchanges identity (temporary) credentials for assume-role credentials with IoT/MQTT
 * permissions. The backend signs the user in with the provided credentials and returns
 * a new credential set for MQTT; this is not refreshing or extending the same credentials.
 */
ESPRMNeoUser.prototype.assumeRole = async function (
  accessKey: string,
  secretKey: string,
  sessionToken: string,
  options?: AssumeRoleOptions
): Promise<AWSCredentials> {
  // Request body: identity (temporary) credentials so backend can assume the IoT role
  const requestBody: Record<string, any> = {
    access_key: accessKey,
    secret_key: secretKey,
    session_token: sessionToken,
  };

  // Merge optional fields (e.g., include: ["s3", "kvs"])
  if (options?.include && options.include.length > 0) {
    requestBody.include = options.include;
  }

  const api = ESPSigV4APIManager.getInstance();
  const response = await api.post<AWSCredentials>(
    APIPathV1.ASSUME_ROLE,
    requestBody
  );

  // Validate response contains required fields
  if (!response.access_key || !response.secret_key || !response.session_token) {
    throw new Error(
      "Invalid assume role response: missing required credential fields"
    );
  }

  return response;
};
