/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../../ESPRMNeoUser";
import { ESPRMNeoMqtt } from "../../../services/ESPRMNeoMqtt/ESPRMNeoMqtt";
import { Logger } from "../../../utils/logger";

const logger = new Logger("DisconnectMQTT");

/**
 * Augments the ESPRMNeoUser class with the `disconnectMQTT` method.
 */
declare module "../../../ESPRMNeoUser" {
  interface ESPRMNeoUser {
    /**
     * Disconnects the MQTT websocket connection if one is active.
     * No-op when MQTT was never initialized or is already disconnected.
     *
     * @throws Error if disconnection fails.
     */
    disconnectMQTT(): Promise<void>;
  }
}

ESPRMNeoUser.prototype.disconnectMQTT = async function (): Promise<void> {
  if (!ESPRMNeoMqtt.hasInstance()) {
    return;
  }
  const mqtt = ESPRMNeoMqtt.getInstance();
  if (!(await mqtt.isConnected())) {
    return;
  }
  try {
    await mqtt.disconnect();
  } catch (error) {
    logger.error("MQTT disconnection failed", error);
    throw error;
  }
};
