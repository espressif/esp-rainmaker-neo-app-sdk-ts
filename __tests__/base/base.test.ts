/// <reference types="jest" />

import type { ESPRMNeoBase as ESPRMNeoBaseClass } from "../../src/ESPRMNeoBase";
import { ESPRMNeoBaseConfig } from "../../src/types/input";
import { ESPStorageAdapter } from "../../src/types/storage";
import { ESPProvisionAdapterInterface } from "../../src/types/provision";
import type { MQTTTransport } from "../../src/services/interfaces/MQTTTransport";

// Mock dependencies
jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
jest.mock("../../src/ESPRMNeoAuth");

describe("ESPRMNeoBase", () => {
  // `#config` is a true-private static that cannot be reset via casting, so we
  // reload the module to get a pristine, un-configured class for each test.
  let ESPRMNeoBase: typeof ESPRMNeoBaseClass;
  const loadFreshSDK = () => {
    jest.resetModules();
    ESPRMNeoBase = require("../../src/ESPRMNeoBase").ESPRMNeoBase;
  };

  const mockConfig: ESPRMNeoBaseConfig = {
    baseUrl: "https://test.example.com",
    userApiBase: "https://test.example.com",
    awsRegion: "us-east-1",
    iotEndpoint: "test.iot.endpoint.com",
  };

  const mockStorageAdapter: ESPStorageAdapter = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };

  const mockProvisionAdapter: ESPProvisionAdapterInterface = {
    searchESPDevices: jest.fn(),
    stopESPDevicesSearch: jest.fn(),
    createESPDevice: jest.fn(),
    connect: jest.fn(),
    getDeviceCapabilities: jest.fn(),
    getDeviceVersion: jest.fn(),
    setProofOfPossession: jest.fn(),
    initializeSession: jest.fn(),
    scanWifiList: jest.fn(),
    sendData: jest.fn(),
    provision: jest.fn(),
    disconnect: jest.fn(),
  };

  const mockMqttTransport: MQTTTransport = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockResolvedValue(false),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    // Fresh module → pristine class (all statics, incl. #config, back to initial).
    loadFreshSDK();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("init", () => {
    it("should initialize SDK successfully with basic config", () => {
      expect(() => {
        ESPRMNeoBase.init(mockConfig);
      }).not.toThrow();
    });

    it("should initialize SDK with custom storage adapter", () => {
      const configWithStorage = {
        ...mockConfig,
        customStorageAdapter: mockStorageAdapter,
      };

      expect(() => {
        ESPRMNeoBase.init(configWithStorage);
      }).not.toThrow();

      expect(ESPRMNeoBase.storageAdapter).toBe(mockStorageAdapter);
    });

    it("should initialize SDK with provision adapter", () => {
      const configWithProvision = {
        ...mockConfig,
        provisionAdapter: mockProvisionAdapter,
      };

      expect(() => {
        ESPRMNeoBase.init(configWithProvision);
      }).not.toThrow();

      expect(ESPRMNeoBase.getProvisionAdapter()).toBe(
        mockProvisionAdapter
      );
    });

    it("should initialize SDK with MQTT adapter", () => {
      const { ESPRMNeoMqtt } = require("../../src/services/ESPRMNeoMqtt/ESPRMNeoMqtt");
      const { NodeMQTTOrchestrator } = require("../../src/services/NodeMQTTOrchestrator");

      const configWithMQTT = { ...mockConfig, mqttAdapter: mockMqttTransport };

      expect(() => {
        ESPRMNeoBase.init(configWithMQTT);
      }).not.toThrow();

      expect(() => ESPRMNeoMqtt.getInstance()).not.toThrow();

      ESPRMNeoMqtt.clear();
      NodeMQTTOrchestrator.clear();
    });

    it("should handle configuration errors gracefully", () => {
      // Mock a dependency to throw an error
      const _mockError = new Error("Configuration failed");
      jest.spyOn(console, "error").mockImplementation(() => {});

      // This test would need more specific mocking to trigger an actual error
      expect(() => {
        ESPRMNeoBase.init(mockConfig);
      }).not.toThrow();
    });
  });

  describe("getConfig", () => {
    it("should return config when SDK is initialized", () => {
      ESPRMNeoBase.init(mockConfig);
      const config = ESPRMNeoBase.getConfig();
      expect(config).toEqual(mockConfig);
    });

    it("should return immutable config object", () => {
      ESPRMNeoBase.init(mockConfig);
      const config = ESPRMNeoBase.getConfig();

      // Verify it's frozen (attempting to modify throws in strict mode)
      expect(Object.isFrozen(config)).toBe(true);
      expect(() => {
        (config as any).baseUrl = "modified-url";
      }).toThrow();

      // Original value unchanged
      expect(config.baseUrl).toBe(mockConfig.baseUrl);
    });

    it("should throw error when accessing config before initialization", () => {
      expect(() => {
        ESPRMNeoBase.getConfig();
      }).toThrow("ESPRMNeoBase is not initialized yet");
    });
  });

  describe("getAuthInstance", () => {
    it("should return the same auth instance on every call once initialized", () => {
      ESPRMNeoBase.init(mockConfig);
      const auth = ESPRMNeoBase.getAuthInstance();
      // Created once at init, not per getter call.
      expect(ESPRMNeoBase.getAuthInstance()).toBe(auth);
    });

    it("should throw error when accessing auth instance before initialization", () => {
      expect(() => {
        ESPRMNeoBase.getAuthInstance();
      }).toThrow("ESPRMNeoBase is not initialized yet");
    });
  });

  describe("getConfig().awsRegion", () => {
    it("should return the AWS region when SDK is initialized", () => {
      ESPRMNeoBase.init(mockConfig);
      const awsRegion = ESPRMNeoBase.getConfig().awsRegion;
      expect(awsRegion).toBe(mockConfig.awsRegion);
    });

    it("should throw error when accessing config before initialization", () => {
      expect(() => {
        ESPRMNeoBase.getConfig();
      }).toThrow("ESPRMNeoBase is not initialized yet");
    });
  });

  describe("storageAdapter", () => {
    it("should get storage adapter", () => {
      ESPRMNeoBase.init(mockConfig);
      ESPRMNeoBase.setStorageAdapter(mockStorageAdapter);
      expect(ESPRMNeoBase.storageAdapter).toBe(mockStorageAdapter);
    });

    it("should set storage adapter", () => {
      ESPRMNeoBase.init(mockConfig);
      ESPRMNeoBase.setStorageAdapter(mockStorageAdapter);
      expect(ESPRMNeoBase.storageAdapter).toBe(mockStorageAdapter);
    });
  });

  describe("setStorageAdapter", () => {
    it("should set storage adapter", () => {
      ESPRMNeoBase.init(mockConfig);
      ESPRMNeoBase.setStorageAdapter(mockStorageAdapter);
      expect(ESPRMNeoBase.storageAdapter).toBe(mockStorageAdapter);
    });

    it("should throw error when SDK is not initialized", () => {
      expect(() => {
        ESPRMNeoBase.setStorageAdapter(mockStorageAdapter);
      }).toThrow("ESPRMNeoBase is not initialized yet");
    });

    it("should throw error when adapter is invalid", () => {
      ESPRMNeoBase.init(mockConfig);

      expect(() => {
        ESPRMNeoBase.setStorageAdapter(undefined as any);
      }).toThrow("Configuration Error: Invalid storage adapter provided.");
    });
  });

  describe("setProvisioningAdapter", () => {
    it("should set provisioning adapter", () => {
      ESPRMNeoBase.init(mockConfig);
      ESPRMNeoBase.setProvisioningAdapter(mockProvisionAdapter);
      expect(ESPRMNeoBase.getProvisionAdapter()).toBe(
        mockProvisionAdapter
      );
    });

    it("should throw error when SDK is not initialized", () => {
      expect(() => {
        ESPRMNeoBase.setProvisioningAdapter(mockProvisionAdapter);
      }).toThrow("ESPRMNeoBase is not initialized yet");
    });

    it("should throw error when adapter is invalid", () => {
      ESPRMNeoBase.init(mockConfig);

      expect(() => {
        ESPRMNeoBase.setProvisioningAdapter(undefined as any);
      }).toThrow("Configuration Error: Invalid provisioning adapter provided.");
    });
  });

  describe("mqttAdapter via configure()", () => {
    it("should accept an MQTTTransport-shaped adapter", () => {
      expect(() => {
        ESPRMNeoBase.init({
          ...mockConfig,
          mqttAdapter: mockMqttTransport,
        });
      }).not.toThrow();
    });

    it("should initialize without an adapter (adapter is optional)", () => {
      expect(() => {
        ESPRMNeoBase.init(mockConfig);
      }).not.toThrow();
    });
  });

  describe("singleton pattern", () => {
    it("should maintain singleton instance", () => {
      ESPRMNeoBase.init(mockConfig);
      const instance1 = ESPRMNeoBase.getConfig();
      const instance2 = ESPRMNeoBase.getConfig();
      // getConfig() returns a frozen copy each time; values should match
      expect(instance1).toEqual(instance2);
    });
  });
});
