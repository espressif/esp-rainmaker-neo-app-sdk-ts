/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigValidator } from "../../src/utils/validator/ConfigValidator";
import { ESPConfigError } from "../../src/utils/error/Error";
import { ConfigErrorCodes } from "../../src/utils/constants";
import { ESPRMNeoBaseConfig } from "../../src/types/input";

describe("ConfigValidator", () => {
  const validConfig: ESPRMNeoBaseConfig = {
    baseUrl: "https://api.rainmaker.espressif.com",
    userApiBase: "https://api.rainmaker.espressif.com",
    awsRegion: "us-east-1",
    iotEndpoint: "your-iot-endpoint.amazonaws.com",
  };

  describe("validateConfig", () => {
    it("should validate a valid configuration", () => {
      expect(() => {
        ConfigValidator.validateConfig(validConfig);
      }).not.toThrow();
    });

    it("should throw ESPConfigError for null config", () => {
      expect(() => {
        ConfigValidator.validateConfig(null as any);
      }).toThrow(ESPConfigError);
    });

    it("should throw ESPConfigError for undefined config", () => {
      expect(() => {
        ConfigValidator.validateConfig(undefined as any);
      }).toThrow(ESPConfigError);
    });

    it("should throw ESPConfigError for invalid baseUrl", () => {
      const invalidConfig = { ...validConfig, baseUrl: "" };
      expect(() => {
        ConfigValidator.validateConfig(invalidConfig);
      }).toThrow(ESPConfigError);

      try {
        ConfigValidator.validateConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_BASE_URL
        );
      }
    });

    it("should throw ESPConfigError for invalid URL format", () => {
      const invalidConfig = { ...validConfig, baseUrl: "not-a-valid-url" };
      expect(() => {
        ConfigValidator.validateConfig(invalidConfig);
      }).toThrow(ESPConfigError);

      try {
        ConfigValidator.validateConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_BASE_URL
        );
      }
    });

    it("should throw ESPConfigError for invalid userApiBase", () => {
      const invalidConfig = { ...validConfig, userApiBase: "" };
      expect(() => {
        ConfigValidator.validateConfig(invalidConfig);
      }).toThrow(ESPConfigError);

      try {
        ConfigValidator.validateConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_USER_API_BASE
        );
      }
    });
    it("should throw ESPConfigError for empty awsRegion", () => {
      const invalidConfig = { ...validConfig, awsRegion: "" };
      expect(() => {
        ConfigValidator.validateConfig(invalidConfig);
      }).toThrow(ESPConfigError);

      try {
        ConfigValidator.validateConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_REGION
        );
      }
    });

    it("should validate config with valid custom storage adapter", () => {
      const configWithStorage = {
        ...validConfig,
        customStorageAdapter: {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        },
      };
      expect(() => {
        ConfigValidator.validateConfig(configWithStorage);
      }).not.toThrow();
    });

    it("should throw ESPConfigError for invalid custom storage adapter", () => {
      const invalidConfig = {
        ...validConfig,
        customStorageAdapter: null as any,
      };
      expect(() => {
        ConfigValidator.validateConfig(invalidConfig);
      }).toThrow(ESPConfigError);

      try {
        ConfigValidator.validateConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_STORAGE_ADAPTER
        );
      }
    });

    it("should validate config with valid MQTT adapter", () => {
      const configWithMQTT = {
        ...validConfig,
        mqttAdapter: {
          connect: jest.fn(),
          disconnect: jest.fn(),
          isConnected: jest.fn(),
          publish: jest.fn(),
          subscribe: jest.fn(),
          unsubscribe: jest.fn(),
        } as any,
      };
      expect(() => {
        ConfigValidator.validateConfig(configWithMQTT);
      }).not.toThrow();
    });

    it("should reject an MQTT adapter missing required methods", () => {
      const configWithBrokenMQTT = {
        ...validConfig,
        mqttAdapter: { connect: jest.fn() } as any,
      };
      try {
        ConfigValidator.validateConfig(configWithBrokenMQTT);
        fail("expected ESPConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_MQTT_ADAPTER
        );
      }
    });

    it("should reject a storage adapter missing required methods", () => {
      const configWithBrokenStorage = {
        ...validConfig,
        customStorageAdapter: { setItem: jest.fn(), getItem: jest.fn() } as any,
      };
      try {
        ConfigValidator.validateConfig(configWithBrokenStorage);
        fail("expected ESPConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_STORAGE_ADAPTER
        );
      }
    });

    it("should throw ESPConfigError for missing iotEndpoint", () => {
      const invalidConfig = { ...validConfig, iotEndpoint: "" };
      try {
        ConfigValidator.validateConfig(invalidConfig);
        fail("expected ESPConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_IOT_ENDPOINT
        );
      }
    });

    it("should reject a provision adapter missing required methods", () => {
      const configWithBrokenProvision = {
        ...validConfig,
        provisionAdapter: { searchESPDevices: jest.fn() } as any,
      };
      try {
        ConfigValidator.validateConfig(configWithBrokenProvision);
        fail("expected ESPConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_PROVISION_ADAPTER
        );
      }
    });

    it("should reject a local control adapter missing required methods", () => {
      const configWithBrokenLC = {
        ...validConfig,
        localControlAdapter: { connect: jest.fn() } as any,
      };
      try {
        ConfigValidator.validateConfig(configWithBrokenLC);
        fail("expected ESPConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_LOCAL_CONTROL_ADAPTER
        );
      }
    });

    it("should reject a local discovery adapter missing required methods", () => {
      const configWithBrokenLD = {
        ...validConfig,
        localDiscoveryAdapter: { startDiscovery: jest.fn() } as any,
      };
      try {
        ConfigValidator.validateConfig(configWithBrokenLD);
        fail("expected ESPConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_LOCAL_DISCOVERY_ADAPTER
        );
      }
    });

    it("should throw ESPConfigError for invalid MQTT adapter", () => {
      const invalidConfig = {
        ...validConfig,
        mqttAdapter: null as any,
      };
      expect(() => {
        ConfigValidator.validateConfig(invalidConfig);
      }).toThrow(ESPConfigError);

      try {
        ConfigValidator.validateConfig(invalidConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ESPConfigError);
        expect((error as ESPConfigError).code).toBe(
          ConfigErrorCodes.INVALID_MQTT_ADAPTER
        );
      }
    });

    it("should validate config without optional adapters", () => {
      const configWithoutAdapters = { ...validConfig };
      delete (configWithoutAdapters as any).customStorageAdapter;
      delete (configWithoutAdapters as any).mqttAdapter;
      expect(() => {
        ConfigValidator.validateConfig(configWithoutAdapters);
      }).not.toThrow();
    });
  });
});
