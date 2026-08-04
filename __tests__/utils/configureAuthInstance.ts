/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoAuth } from "../../src/ESPRMNeoAuth";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";

export function configureAuthInstance(): ESPRMNeoAuth {
  ESPRMNeoBase.init({
    baseUrl: process.env.BASE_URL || "https://api.rainmaker.espressif.com",
    userApiBase:
      process.env.USER_API_BASE || "https://api.rainmaker.espressif.com",
    awsRegion: process.env.REGION || "us-east-1",
    iotEndpoint: process.env.IOT_ENDPOINT || "test-iot-endpoint",
  });

  return ESPRMNeoBase.getAuthInstance();
}
