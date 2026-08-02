/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPStorageAdapter } from "./storage";
import { ESPProvisionAdapterInterface } from "./provision";
import { MQTTTransport } from "../services/interfaces/MQTTTransport";
import { ESPLocalControlAdapterInterface } from "./localControl";
import { ESPLocalDiscoveryAdapterInterface } from "./discovery";

/**
 * Data structure for user tokens.
 */
export interface UserTokensData {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export interface ESPAWSCredentials {
  accessKey: string;
  secretKey: string;
  sessionToken: string;
  expiration: string;
  /** Optional status text from POST /v1/user/credentials. */
  message?: string;
}

export interface AWSCredentials {
  access_key: string;
  secret_key: string;
  session_token: string;
  /** Unix timestamp (int64); optional. */
  expiration?: number;
}

/**
 * SDK configuration for {@link ESPRMNeoBase.configure}.
 * Supplies Rainmaker API base URL, Cognito/IoT identifiers, and optional adapters.
 *
 * Put the API Gateway stage in `baseUrl` when using the default execute-api host
 * (e.g. `https://xxx.execute-api.region.amazonaws.com/prod`). Custom domains
 * typically need no stage segment.
 */
export interface ESPRMNeoBaseConfig {
  /**
   * Full main API base, including stage if any.
   * e.g. "https://xxx.execute-api.us-east-1.amazonaws.com/prod"
   * or custom domain "https://api.example.com"
   */
  baseUrl: string;
  /**
   * Full User/auth API base, including stage if any.
   * e.g. "https://xxx.execute-api.us-east-1.amazonaws.com/prod"
   * or custom domain "https://api.example.com"
   */
  userApiBase: string;

  awsRegion: string; // AWS region (e.g., "us-east-1")
  iotEndpoint: string;
  customStorageAdapter?: ESPStorageAdapter;
  provisionAdapter?: ESPProvisionAdapterInterface;
  mqttAdapter?: MQTTTransport;
  localControlAdapter?: ESPLocalControlAdapterInterface;
  localDiscoveryAdapter?: ESPLocalDiscoveryAdapterInterface;
}

export interface AssumeRoleRequest {
  access_key: string;
  secret_key: string;
  session_token: string;
  tags?: Record<string, string>;
  group?: string; // Admin only - Group ID to scope credentials to
  subgroup?: string; // Admin only - Subgroup ID (requires group)
}

/**
 * Delivery credentials for registering an integration endpoint
 * (PUT /v1/integrations/{integrationId}/endpoints). The documented field is
 * `app_token`; different integration types may accept additional credentials.
 */
export interface DeliveryCredentials {
  app_token: string;
  [key: string]: string;
}

/**
 * Request body for PUT /v1/integrations/{integrationId}/endpoints.
 */
export interface RegisterEndpointRequest {
  delivery_credentials: DeliveryCredentials;
  locale?: string;
}
