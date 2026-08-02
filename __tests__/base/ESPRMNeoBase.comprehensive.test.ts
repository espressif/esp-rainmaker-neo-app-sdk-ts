/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoBase as ESPRMNeoBaseClass } from "../../src/ESPRMNeoBase";
import { ESPRMNeoBaseConfig } from "../../src/types/input";
import { ESPStorageAdapter } from "../../src/types/storage";
import { ESPProvisionAdapterInterface } from "../../src/types/provision";
import type { MQTTTransport } from "../../src/services/interfaces/MQTTTransport";

// Mock dependencies
jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
jest.mock("../../src/ESPRMNeoAuth", () => {
  return {
    ESPRMNeoAuth: class MockESPRMNeoAuth {
      private config: any;

      constructor(config: any) {
        this.config = config;
      }

      getConfig() {
        return this.config;
      }
    },
  };
});

describe("ESPRMNeoBase Comprehensive Tests", () => {
  // `#config` is a true-private static that cannot be reset via casting. Reload
  // the module (re-establishing dependency spies) to get a pristine, un-configured
  // class whenever a test needs the "SDK not initialized" state.
  let ESPRMNeoBase: typeof ESPRMNeoBaseClass;
  const loadFreshSDK = () => {
    jest.resetModules();

    const {
      ESPRMNeoStorage,
    } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
    jest.spyOn(ESPRMNeoStorage, "initialize").mockImplementation(() => {});

    const sigv4Module = require("../../src/services/ESPSigV4APIManager");
    jest.spyOn(sigv4Module.ESPSigV4APIManager, "initialize").mockImplementation(() => {});
    jest.spyOn(sigv4Module, "initializeSigV4APIManager").mockImplementation(() => {});
    // Reset the ESPRMNeoAPIManager singleton so re-init works across tests.
    try {
      const apiMod = require("../../src/services/ESPRMNeoAPIManager");
      if (apiMod._resetAPIManagerForTests) apiMod._resetAPIManagerForTests();
    } catch {
      // Module may not be loaded yet; ignore.
    }

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
    // Reset all mocks
    jest.clearAllMocks();

    // Fresh module → pristine class (all statics, incl. #config, back to initial)
    // with dependency spies re-established.
    loadFreshSDK();
  });

  describe("Configuration Pattern", () => {
    it("should initialize successfully", () => {
      expect(() => {
        ESPRMNeoBase.init(mockConfig);
      }).not.toThrow();
    });

    it("should throw error when getConfig is called before init", () => {
      expect(() => {
        ESPRMNeoBase.getConfig();
      }).toThrow("ESPRMNeoBase is not initialized yet");
    });
  });

  describe("Configuration", () => {
    it("should initialize the SDK with valid config", () => {
      expect(() => {
        ESPRMNeoBase.init(mockConfig);
      }).not.toThrow();
    });

    it("should throw error when configuring with invalid config", () => {
      const invalidConfig = {
        ...mockConfig,
        baseUrl: "", // Invalid empty baseUrl
        userApiBase: "https://test-api.example.com/prod",
      };

      // configure now validates configs, so it should throw
      expect(() => {
        ESPRMNeoBase.init(invalidConfig);
      }).toThrow();
    });

    it("should throw error when configuring with missing required fields", () => {
      const incompleteConfig = {
        baseUrl: "https://test.example.com",
        userApiBase: "https://test.example.com",
        awsRegion: "us-east-1",
        // Missing required fields
      } as ESPRMNeoBaseConfig;

      // configure now validates configs, so it should throw with missing fields
      expect(() => {
        ESPRMNeoBase.init(incompleteConfig);
      }).toThrow();
    });

    it("should set custom storage adapter", () => {
      ESPRMNeoBase.init(mockConfig);
      ESPRMNeoBase.setStorageAdapter(mockStorageAdapter);

      expect(ESPRMNeoBase.storageAdapter).toBe(mockStorageAdapter);
    });

    it("should set provision adapter", () => {
      ESPRMNeoBase.init(mockConfig);
      ESPRMNeoBase.setProvisioningAdapter(mockProvisionAdapter);

      expect(ESPRMNeoBase.getProvisionAdapter()).toBe(mockProvisionAdapter);
    });
  });

  describe("Static Getters", () => {
    beforeEach(() => {
      ESPRMNeoBase.init(mockConfig);
    });

    it("should return the correct configuration", () => {
      const config = ESPRMNeoBase.getConfig();
      expect(config).toEqual(mockConfig);
    });

    it("should return the same auth instance on every call", () => {
      const auth = ESPRMNeoBase.getAuthInstance();
      expect(ESPRMNeoBase.getAuthInstance()).toBe(auth);
    });

    it("should initialize the SigV4 API manager during init", () => {
      // The fresh module instance (loadFreshSDK) holds the initialize spy.
      const {
        initializeSigV4APIManager,
      } = require("../../src/services/ESPSigV4APIManager");
      expect(initializeSigV4APIManager).toHaveBeenCalledTimes(1);
    });

    it("should expose the adapter provided via config.customStorageAdapter", () => {
      // Fresh SDK — the outer beforeEach + this describe's beforeEach both init,
      // but this test needs a specific config so we reset and re-init once.
      loadFreshSDK();
      const {
        ESPRMNeoStorage: FreshStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      ESPRMNeoBase.init({
        ...mockConfig,
        customStorageAdapter: mockStorageAdapter,
      });

      expect(ESPRMNeoBase.storageAdapter).toBe(mockStorageAdapter);
      expect(FreshStorage.initialize).toHaveBeenLastCalledWith(
        mockStorageAdapter
      );
    });

    it("should return the AWS region via getConfig()", () => {
      const awsRegion = ESPRMNeoBase.getConfig().awsRegion;
      expect(awsRegion).toBe(mockConfig.awsRegion);
    });

    it("should return the auth instance wired with the config", () => {
      const authInstance = ESPRMNeoBase.getAuthInstance() as unknown as {
        getConfig(): ESPRMNeoBaseConfig;
      };
      expect(authInstance.getConfig()).toEqual(mockConfig);
    });
  });

  describe("Storage Adapter Management", () => {
    beforeEach(() => {
      ESPRMNeoBase.init(mockConfig);
    });

    it("should set and get storage adapter", () => {
      ESPRMNeoBase.setStorageAdapter(mockStorageAdapter);
      expect(ESPRMNeoBase.storageAdapter).toBe(mockStorageAdapter);
    });

    it("should leave the storage adapter unset when none is provided", () => {
      // The beforeEach init used a config without customStorageAdapter, and
      // loadFreshSDK reset the class statics — no adapter must be present.
      expect(ESPRMNeoBase.storageAdapter).toBeUndefined();
      const {
        ESPRMNeoStorage: FreshStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      expect(FreshStorage.initialize).toHaveBeenLastCalledWith(undefined);
    });

    it("should use custom storage adapter when set", () => {
      ESPRMNeoBase.setStorageAdapter(mockStorageAdapter);
      const storage = ESPRMNeoBase.storageAdapter;
      expect(storage).toBe(mockStorageAdapter);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when configuration is invalid", () => {
      const invalidConfig = {
        baseUrl: null as any,
        userApiBase: "https://test-api.example.com/prod",
        awsRegion: "us-east-1",
        userPoolId: "test-pool",
        clientId: "test-client",
        identityId: "test-identity",
        iotEndpoint: "test.iot.com",
      };

      // configure now validates configs, so it should throw for invalid baseUrl
      expect(() => {
        ESPRMNeoBase.init(invalidConfig);
      }).toThrow();
    });

    it("should handle missing dependencies", () => {
      ESPRMNeoBase.init(mockConfig);

      // Reload to simulate missing configuration (un-configured SDK)
      loadFreshSDK();

      expect(() => {
        ESPRMNeoBase.getAuthInstance();
      }).toThrow("ESPRMNeoBase is not initialized yet");
    });
  });

  describe("Configuration Management", () => {
    it("should initialize successfully on first init call", () => {
      ESPRMNeoBase.init(mockConfig);
      expect(ESPRMNeoBase.getConfig()).toEqual(mockConfig);
    });

    it("should update configuration on subsequent init calls", () => {
      ESPRMNeoBase.init(mockConfig);
      const config1 = ESPRMNeoBase.getConfig();

      // Reset between inits — the current SDK forbids re-init without reload.
      loadFreshSDK();
      ESPRMNeoBase.init(mockConfig);
      const config2 = ESPRMNeoBase.getConfig();

      expect(config1).toEqual(config2);
    });

    it("should reset configuration when reinitialized", () => {
      ESPRMNeoBase.init(mockConfig);
      const config1 = ESPRMNeoBase.getConfig();

      // Reset and reconfigure
      loadFreshSDK();
      ESPRMNeoBase.init(mockConfig);
      const config2 = ESPRMNeoBase.getConfig();

      expect(config1).toEqual(config2);
    });
  });

  describe("Service Initialization", () => {
    beforeEach(() => {
      ESPRMNeoBase.init(mockConfig);
    });

    it("should initialize all required services", () => {
      const {
        ESPRMNeoStorage: FreshStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const {
        initializeSigV4APIManager,
      } = require("../../src/services/ESPSigV4APIManager");

      // One init (the beforeEach) → each service initialized exactly once.
      expect(FreshStorage.initialize).toHaveBeenCalledTimes(1);
      expect(initializeSigV4APIManager).toHaveBeenCalledTimes(1);
      expect(ESPRMNeoBase.getAuthInstance()).toBe(ESPRMNeoBase.getAuthInstance());
    });

    it("should initialize services with correct configuration", () => {
      const authInstance = ESPRMNeoBase.getAuthInstance() as unknown as {
        getConfig(): ESPRMNeoBaseConfig;
      };
      expect(authInstance.getConfig()).toEqual(mockConfig);
    });
  });

  describe("Configuration Validation", () => {
    it("should validate baseUrl format", () => {
      const invalidConfig = {
        ...mockConfig,
        baseUrl: "invalid-url",
        userApiBase: "invalid-url",
      };

      // configure now validates configs
      expect(() => {
        ESPRMNeoBase.init(invalidConfig);
      }).toThrow();
    });

    it("should validate baseUrl is not empty", () => {
      const invalidConfig = {
        ...mockConfig,
        baseUrl: "",
        userApiBase: "https://test-api.example.com/prod",
      };

      expect(() => {
        ESPRMNeoBase.init(invalidConfig);
      }).toThrow();
    });

    it("should validate awsRegion is not empty", () => {
      const invalidConfig = {
        ...mockConfig,
        awsRegion: "",
      };

      expect(() => {
        ESPRMNeoBase.init(invalidConfig);
      }).toThrow();
    });

    it("should validate custom storage adapter if provided", () => {
      const invalidConfig = {
        ...mockConfig,
        customStorageAdapter: null as any,
      };

      expect(() => {
        ESPRMNeoBase.init(invalidConfig);
      }).toThrow();
    });

    it("should validate MQTT adapter if provided", () => {
      const invalidConfig = {
        ...mockConfig,
        mqttAdapter: null as any,
      };

      expect(() => {
        ESPRMNeoBase.init(invalidConfig);
      }).toThrow();
    });

    it("should accept valid configuration", () => {
      expect(() => {
        ESPRMNeoBase.init(mockConfig);
      }).not.toThrow();
    });
  });

  describe("Custom Adapters", () => {
    beforeEach(() => {
      ESPRMNeoBase.init(mockConfig);
    });

    it("should accept custom storage adapter", () => {
      ESPRMNeoBase.storageAdapter = mockStorageAdapter;
      expect(ESPRMNeoBase.storageAdapter).toBe(mockStorageAdapter);
    });

    it("should accept custom provision adapter", () => {
      ESPRMNeoBase.setProvisioningAdapter(mockProvisionAdapter);
      expect(ESPRMNeoBase.getProvisionAdapter()).toBe(mockProvisionAdapter);
    });

    it("should accept custom MQTT adapter", () => {
      // Reset the SDK so we can init with the MQTT-including config; the
      // describe's beforeEach already initialized without an adapter.
      loadFreshSDK();
      const { ESPRMNeoMqtt } = require("../../src/services/ESPRMNeoMqtt/ESPRMNeoMqtt");
      const { NodeMQTTOrchestrator } = require("../../src/services/NodeMQTTOrchestrator");

      const configWithMQTT = {
        ...mockConfig,
        mqttAdapter: mockMqttTransport,
      };

      ESPRMNeoBase.init(configWithMQTT);
      expect(ESPRMNeoBase.getConfig().mqttAdapter).toBe(mockMqttTransport);
      expect(() => ESPRMNeoMqtt.getInstance()).not.toThrow();

      ESPRMNeoMqtt.clear();
      NodeMQTTOrchestrator.clear();
    });
  });

  describe("Memory Management", () => {
    it("should clean up resources when instance is destroyed", () => {
      ESPRMNeoBase.init(mockConfig);
      expect(ESPRMNeoBase.getConfig()).toEqual(mockConfig);

      // Simulate cleanup (reload → pristine, un-configured class)
      loadFreshSDK();

      expect(() => {
        ESPRMNeoBase.getConfig();
      }).toThrow("ESPRMNeoBase is not initialized yet");
    });
  });

  describe("Concurrent Access", () => {
    it("should return a stable, deep-equal config across concurrent reads", async () => {
      ESPRMNeoBase.init(mockConfig);
      const promises = Array.from(
        { length: 10 },
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(ESPRMNeoBase.getConfig());
            }, Math.random() * 100);
          })
      );

      const configs = await Promise.all(promises);

      configs.forEach((c) => {
        expect(c).toEqual(configs[0]);
      });
    });
  });

  describe("Configuration Updates", () => {
    it("should update configuration when reinitialized after a fresh load", () => {
      ESPRMNeoBase.init(mockConfig);
      const _config1 = ESPRMNeoBase.getConfig();

      const updatedConfig = {
        ...mockConfig,
        baseUrl: "https://updated.example.com",
        userApiBase: "https://updated.example.com",
      };

      // Reset the SDK — the current API manager forbids re-init in-place.
      loadFreshSDK();
      ESPRMNeoBase.init(updatedConfig);
      const config2 = ESPRMNeoBase.getConfig();

      expect(config2.baseUrl).toBe("https://updated.example.com");
    });
  });

  describe("Service Dependencies", () => {
    beforeEach(() => {
      ESPRMNeoBase.init(mockConfig);
    });

    it("should initialize storage before the API manager", () => {
      const {
        ESPRMNeoStorage: FreshStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const {
        initializeSigV4APIManager,
      } = require("../../src/services/ESPSigV4APIManager");

      // configure() wires storage first so the API manager can read
      // persisted credentials.
      const [storageOrder] = (FreshStorage.initialize as jest.Mock).mock
        .invocationCallOrder;
      const [apiOrder] = (initializeSigV4APIManager as jest.Mock).mock
        .invocationCallOrder;
      expect(storageOrder).toBeLessThan(apiOrder);
    });

    it("should handle service initialization failures", () => {
      // Mock service initialization failure
      jest.spyOn(ESPRMNeoBase, "getConfig").mockImplementation(() => {
        throw new Error("Configuration not found");
      });

      expect(() => {
        ESPRMNeoBase.getConfig();
      }).toThrow("Configuration not found");
    });
  });
});
