/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// ConnectMQTT.ts

import { ESPRMNeoUser } from "../../../ESPRMNeoUser";
import { ESPRMNeoBase } from "../../../ESPRMNeoBase";
import { ESPRMNeoMqtt } from "../../../services/ESPRMNeoMqtt/ESPRMNeoMqtt";
import { decodeToken } from "../../../services/ESPRMNeoHelpers/DecodeToken";
import { Logger } from "../../../utils/logger";
import { resolveMqttWebSocketEndpoint } from "../../../utils/mqtt";
import { ESPMQTTConfig } from "../../../services/ESPRMNeoMqtt/ESPRMNeoMqtt";

const logger = new Logger("ConnectMQTT");

/**
 * Resolves the login identity (email or phone) used in the MQTT client ID.
 * Prefer phone_number / email claims; fall back to cognito:username.
 */
function resolveMqttUserIdentity(idToken: string): string {
  const payload = decodeToken(idToken);
  const asString = (value: unknown): string | undefined =>
    typeof value === "string" && value.length > 0 ? value : undefined;

  const identity =
    asString(payload.phone_number) ||
    asString(payload.email) ||
    asString(payload["cognito:username"]);

  if (!identity) {
    throw new Error(
      "Unable to resolve MQTT client identity from ID token (email or phone required)"
    );
  }
  return identity;
}

/**
 * Per-session suffix so concurrent sessions (phone + dashboard + reinstall)
 * do not collide on the same AWS IoT client ID.
 */
function createMqttSessionSuffix(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

/**
 * Augments the ESPRMNeoUser class with the `connectMQTT` method.
 */
declare module "../../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Connects to MQTT websocket.
     *
     * Client ID format: `user:<email|phone>:<session>` — required by the
     * assume-role IoT policy which scopes `iot:Connect` to that prefix.
     *
     * @returns A promise that resolves to `true` if connection was successful.
     * @throws Error if connection fails or AWS credentials are not set
     */
    connectMQTT(): Promise<boolean>;
  }
}

ESPRMNeoUser.prototype.connectMQTT = async function (): Promise<boolean> {
  try {
    await this.disconnectMQTT();

    const config = ESPRMNeoBase.getConfig();
    const endpoint = resolveMqttWebSocketEndpoint(config.iotEndpoint);
    const creds = await this.getTemporaryAWSCredentials();
    const assumeRoleCreds = await this.assumeRole(creds.accessKey, creds.secretKey, creds.sessionToken);

    const idToken = await this.getIdToken();
    const identity = resolveMqttUserIdentity(idToken);
    const credentials: ESPMQTTConfig = {
      clientId: `user:${identity}:${createMqttSessionSuffix()}`,
      endpoint,
      accessKey: assumeRoleCreds.access_key,
      secretKey: assumeRoleCreds.secret_key,
      sessionToken: assumeRoleCreds.session_token,
      region: config.awsRegion,
    };

    await ESPRMNeoMqtt.getInstance().connect(credentials);
    logger.debug("MQTT connected successfully", { clientId: credentials.clientId });
    return true;
  } catch (error) {
    logger.error("Error in MQTT connection setup", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
};
