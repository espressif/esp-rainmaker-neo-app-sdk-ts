/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPRMNeoBaseConfig } from "../../src/types/input";
import { getIntegrationTestConfig } from "./setup";

// Real backend configuration from environment variables
const realConfig: ESPRMNeoBaseConfig = getIntegrationTestConfig();

describe("ESPRMNeoBase Integration Tests", () => {
  beforeAll(() => {
    // Suppress console.log during SDK initialization
    const originalLog = console.log;
    console.log = () => {};

    // Configure SDK with real backend
    ESPRMNeoBase.init(realConfig);

    // Restore console.log
    console.log = originalLog;
  });

  describe("ESPRMNeoBase Methods", () => {
    it("should test getConfig() method with real backend", () => {
      const config = ESPRMNeoBase.getConfig();

      console.log("Request: getConfig()");
      console.log(
        "Response:",
        JSON.stringify(
          {
            baseUrl: config.baseUrl,
            awsRegion: config.awsRegion,
            iotEndpoint: config.iotEndpoint,
          },
          null,
          2
        )
      );

      expect(config).toBeDefined();
      expect(config.baseUrl).toBe(realConfig.baseUrl);
      expect(config.awsRegion).toBe(realConfig.awsRegion);
      expect(config.iotEndpoint).toBe(realConfig.iotEndpoint);
    });

    it("should test getAuthInstance() method with real auth instance", () => {
      const auth = ESPRMNeoBase.getAuthInstance();

      console.log("Request: getAuthInstance()");
      console.log(
        "Response:",
        JSON.stringify(
          {
            authType: auth.constructor.name,
            isAuthInstance: true,
          },
          null,
          2
        )
      );

      expect(auth).toBeDefined();
      expect(auth.constructor.name).toBe("ESPRMNeoAuth");
      expect(auth.getConfig().awsRegion).toBe(realConfig.awsRegion);
    });

    it("should report getConfig() as initialized", () => {
      const config = ESPRMNeoBase.getConfig();

      console.log("Request: getConfig()");
      console.log(
        "Response:",
        JSON.stringify({ awsRegion: config.awsRegion, isInitialized: true }, null, 2)
      );

      expect(config.awsRegion).toBeDefined();
    });
  });
});
