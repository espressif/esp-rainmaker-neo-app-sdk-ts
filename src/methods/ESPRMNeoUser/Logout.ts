/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPRMNeoStorage } from "../../services/ESPRMNeoStorage/ESPRMNeoStorage";
import { NodeMQTTOrchestrator } from "../../services/NodeMQTTOrchestrator";
import { Logger } from "../../utils/logger";
import {
  clearNodeConfigCache,
  clearTokens,
  errorDetail,
  failSafe,
  invalidateServerSession,
} from "../../utils/userUtils";

const logger = new Logger("Logout");

/**
 * Augments the ESPRMNeoUser class with the `logout` method.
 */
declare module "../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Logs out the user by invalidating the server session (best-effort),
     * disconnecting MQTT, clearing tokens/credentials, and resetting local state.
     *
     * @returns A promise that resolves to `true` if local cleanup completed,
     * `false` if an unexpected error occurred.
     */
    logout(): Promise<boolean>;
  }
}

/**
 * Logs out the user:
 * 1. Best-effort `POST /v1/user/auth/signout`
 * 2. Disconnect MQTT and reset orchestrator session
 * 3. Clear tokens, AWS credentials, and node config cache
 */
ESPRMNeoUser.prototype.logout = async function (): Promise<boolean> {
  logger.debug("logout called");

  try {
    await failSafe("invalidateServerSession", invalidateServerSession);
    await failSafe("disconnectMQTT", () => this.disconnectMQTT());
    await failSafe("resetMqttSession", () => {
      NodeMQTTOrchestrator.resetSession();
    });
    await failSafe("clearTokens", clearTokens);
    await failSafe("clearAwsCredentials", () =>
      ESPRMNeoStorage.clearTemporaryCredentials()
    );
    await failSafe("clearNodeConfigCache", clearNodeConfigCache);

    logger.debug("logout succeeded");
    return true;
  } catch (error) {
    logger.error("logout failed", { error: errorDetail(error) });
    return false;
  }
};
