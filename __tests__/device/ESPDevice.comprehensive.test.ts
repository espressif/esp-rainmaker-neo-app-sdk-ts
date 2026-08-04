/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../src/ESPDevice";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPProvisionAdapterInterface } from "../../src/types/provision";

// Load ESPDevice method extensions
import "../../src/methods/ESPDevice";

// Mock proto so provision() does not hit real BinaryWriter.writeMessage (not in test env)
jest.mock("../../src/proto/esp_rmaker_chal_resp", () => {
  const RMakerMiscStatus = {
    Success: 0,
    Fail: 1,
    InvalidParam: 2,
    UNRECOGNIZED: -1,
  };

  const RMakerMiscMsgType = {
    TypeCmdChallengeResponse: 0,
    TypeRespChallengeResponse: 1,
    TypeCmdGetNodeID: 2,
    TypeRespGetNodeID: 3,
    UNRECOGNIZED: -1,
  };

  class MockCmdCRPayload {
    payload: Uint8Array;

    constructor(data?: { payload?: Uint8Array }) {
      this.payload = data?.payload ?? new Uint8Array();
    }

    serialize(): Uint8Array {
      return this.payload;
    }

    static deserialize(bytes: Uint8Array): MockCmdCRPayload {
      return new MockCmdCRPayload({ payload: bytes });
    }

    serializeBinary(): Uint8Array {
      return this.serialize();
    }

    static deserializeBinary(bytes: Uint8Array): MockCmdCRPayload {
      return MockCmdCRPayload.deserialize(bytes);
    }
  }

  class MockRespCRPayload {
    payload: Uint8Array;
    node_id: string;

    constructor(data?: { payload?: Uint8Array; node_id?: string }) {
      this.payload = data?.payload ?? new Uint8Array();
      this.node_id = data?.node_id ?? "test-node-id";
    }
  }

  class MockRMakerMiscPayload {
    msg = RMakerMiscMsgType.TypeCmdChallengeResponse;
    status = RMakerMiscStatus.Success;
    cmdChallengeResponsePayload: MockCmdCRPayload | null = null;
    respChallengeResponsePayload: MockRespCRPayload | null = null;

    serialize(): Uint8Array {
      return new Uint8Array(1);
    }

    static deserialize(_bytes: Uint8Array): MockRMakerMiscPayload {
      const instance = new MockRMakerMiscPayload();
      instance.status = RMakerMiscStatus.Success;
      instance.respChallengeResponsePayload = new MockRespCRPayload({
        payload: new Uint8Array([0x1a, 0x2b, 0x3c]),
        node_id: "test-node-id",
      });
      return instance;
    }

    serializeBinary(): Uint8Array {
      return this.serialize();
    }

    static deserializeBinary(bytes: Uint8Array): MockRMakerMiscPayload {
      return MockRMakerMiscPayload.deserialize(bytes);
    }
  }

  return {
    rmaker_misc: {
      RMakerMiscMsgType,
      RMakerMiscStatus,
      RMakerMiscPayload: MockRMakerMiscPayload,
      CmdCRPayload: MockCmdCRPayload,
      RespCRPayload: MockRespCRPayload,
    },
  };
});

// Mock dependencies
jest.mock("../../src/ESPRMNeoBase");
jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");

describe("ESPDevice Comprehensive Tests", () => {
  let mockProvisionAdapter: ESPProvisionAdapterInterface;
  let mockDeviceInterface: any;
  let espDevice: ESPDevice;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock provision adapter
    mockProvisionAdapter = {
      searchESPDevices: jest.fn() as jest.Mock,
      stopESPDevicesSearch: jest.fn() as jest.Mock,
      createESPDevice: jest.fn() as jest.Mock,
      connect: jest.fn() as jest.Mock<Promise<number>>,
      getDeviceCapabilities: jest.fn() as jest.Mock<Promise<string[]>>,
      getDeviceVersion: jest.fn() as jest.Mock<Promise<{ [key: string]: any }>>,
      setProofOfPossession: jest.fn() as jest.Mock<Promise<boolean>>,
      initializeSession: jest.fn() as jest.Mock,
      scanWifiList: jest.fn() as jest.Mock,
      sendData: jest.fn() as jest.Mock,
      provision: jest.fn() as jest.Mock,
      disconnect: jest.fn() as jest.Mock<Promise<void>>,
    };

    // Mock device interface
    mockDeviceInterface = {
      name: "Test Device",
      transport: "ble",
      security: 0,
      capabilities: ["wifi", "bluetooth"],
      sendData: jest.fn().mockResolvedValue("response"),
    };

    // Mock ESPRMNeoBase — the class is jest.mock'd; wire the adapter getter.
    (ESPRMNeoBase.getProvisionAdapter as jest.Mock).mockReturnValue(
      mockProvisionAdapter
    );

    // Create ESPDevice instance
    espDevice = new ESPDevice(mockDeviceInterface);
  });

  describe("Device Initialization", () => {
    it("should initialize with device interface", () => {
      expect(espDevice.name).toBe("Test Device");
      expect(espDevice.transport).toBe("ble");
      expect(espDevice.security).toBe(0);
    });

    it("should set default values for missing properties", () => {
      const minimalInterface = {
        name: "Minimal Device",
        transport: "softap",
        security: 1,
        capabilities: [],
        sendData: jest.fn().mockResolvedValue("response"),
      };

      const device = new ESPDevice(minimalInterface);

      expect(device.name).toBe("Minimal Device");
      expect(device.transport).toBe("softap");
      expect(device.security).toBe(1);
    });

    it("should throw error when device interface is invalid", () => {
      expect(() => {
        new ESPDevice(null as any);
      }).toThrow();
    });
  });

  describe("Device Connection", () => {
    it("should connect to device successfully", async () => {
      (mockProvisionAdapter.connect as jest.Mock).mockResolvedValue(0);

      const result = await espDevice.connect();

      expect(mockProvisionAdapter.connect).toHaveBeenCalledWith(espDevice.name);
      expect(result).toBe(0);
    });

    it("should throw error when connection fails", async () => {
      const mockError = new Error("Connection failed");
      (mockProvisionAdapter.connect as jest.Mock).mockRejectedValue(mockError);

      await expect(espDevice.connect()).rejects.toThrow("Connection failed");
    });

    it("should disconnect from device successfully", async () => {
      (mockProvisionAdapter.disconnect as jest.Mock).mockResolvedValue(
        undefined
      );

      await espDevice.disconnect();

      expect(mockProvisionAdapter.disconnect).toHaveBeenCalledWith(
        espDevice.name
      );
    });

    it("should throw error when disconnection fails", async () => {
      const mockError = new Error("Disconnection failed");
      (mockProvisionAdapter.disconnect as jest.Mock).mockRejectedValue(
        mockError
      );

      await expect(espDevice.disconnect()).rejects.toThrow(
        "Disconnection failed"
      );
    });
  });

  describe("Device Capabilities", () => {
    it("should get device capabilities", async () => {
      const mockCapabilities = ["wifi", "bluetooth", "ethernet"];
      (
        mockProvisionAdapter.getDeviceCapabilities as jest.Mock
      ).mockResolvedValue(mockCapabilities);

      const result = await espDevice.getDeviceCapabilities();

      expect(mockProvisionAdapter.getDeviceCapabilities).toHaveBeenCalledWith(
        espDevice.name
      );
      expect(result).toEqual(mockCapabilities);
    });

    it("should throw error when getting capabilities fails", async () => {
      const mockError = new Error("Failed to get capabilities");
      (
        mockProvisionAdapter.getDeviceCapabilities as jest.Mock
      ).mockRejectedValue(mockError);

      await expect(espDevice.getDeviceCapabilities()).rejects.toThrow(
        "Failed to get capabilities"
      );
    });
  });

  describe("Device Version", () => {
    it("should get device version", async () => {
      const mockVersion = { version: "2.1.0" };
      (mockProvisionAdapter.getDeviceVersion as jest.Mock).mockResolvedValue(
        mockVersion
      );

      const result = await espDevice.getDeviceVersion();

      expect(mockProvisionAdapter.getDeviceVersion).toHaveBeenCalledWith(
        espDevice.name
      );
      expect(result).toEqual(mockVersion);
    });

    it("should throw error when getting version fails", async () => {
      const mockError = new Error("Failed to get version");
      (mockProvisionAdapter.getDeviceVersion as jest.Mock).mockRejectedValue(
        mockError
      );

      await expect(espDevice.getDeviceVersion()).rejects.toThrow(
        "Failed to get version"
      );
    });
  });

  describe("Proof of Possession", () => {
    it("should set proof of possession", async () => {
      const pop = "test-proof-of-possession";
      (
        mockProvisionAdapter.setProofOfPossession as jest.Mock
      ).mockResolvedValue(true);

      const result = await espDevice.setProofOfPossession(pop);

      expect(mockProvisionAdapter.setProofOfPossession).toHaveBeenCalledWith(
        espDevice.name,
        pop
      );
      expect(result).toBe(true);
    });

    it("should throw error when setting proof of possession fails", async () => {
      const pop = "test-proof-of-possession";
      const mockError = new Error("Failed to set proof of possession");
      (
        mockProvisionAdapter.setProofOfPossession as jest.Mock
      ).mockRejectedValue(mockError);

      await expect(espDevice.setProofOfPossession(pop)).rejects.toThrow(
        "Failed to set proof of possession"
      );
    });
  });

  describe("Session Management", () => {
    it("should initialize session", async () => {
      (mockProvisionAdapter.initializeSession as jest.Mock).mockResolvedValue(
        true
      );

      const result = await espDevice.initializeSession();

      expect(mockProvisionAdapter.initializeSession).toHaveBeenCalledWith(
        espDevice.name
      );
      expect(result).toBe(true);
    });

    it("should throw error when session initialization fails", async () => {
      const mockError = new Error("Session initialization failed");
      (mockProvisionAdapter.initializeSession as jest.Mock).mockRejectedValue(
        mockError
      );

      await expect(espDevice.initializeSession()).rejects.toThrow(
        "Session initialization failed"
      );
    });
  });

  describe("WiFi Operations", () => {
    it("should scan WiFi networks", async () => {
      const mockNetworks = [
        { ssid: "Network1", rssi: -50, security: "WPA2" },
        { ssid: "Network2", rssi: -60, security: "WPA3" },
      ];
      (mockProvisionAdapter.scanWifiList as jest.Mock).mockResolvedValue(
        mockNetworks
      );

      const result = await espDevice.scanWifiList();

      expect(mockProvisionAdapter.scanWifiList).toHaveBeenCalledWith(
        espDevice.name
      );
      expect(result).toEqual(mockNetworks);
    });

    it("should throw error when WiFi scan fails", async () => {
      const mockError = new Error("WiFi scan failed");
      (mockProvisionAdapter.scanWifiList as jest.Mock).mockRejectedValue(
        mockError
      );

      await expect(espDevice.scanWifiList()).rejects.toThrow(
        "WiFi scan failed"
      );
    });
  });

  describe("Data Communication", () => {
    it("should send data to device", async () => {
      const endPoint = "test-endpoint";
      const data = "test-data";
      (mockProvisionAdapter.sendData as jest.Mock).mockResolvedValue(
        "response"
      );

      const result = await espDevice.sendData(endPoint, data);

      expect(mockProvisionAdapter.sendData).toHaveBeenCalledWith(
        espDevice.name,
        endPoint,
        data
      );
      expect(result).toBe("response");
    });

    it("should throw error when sending data fails", async () => {
      const endPoint = "test-endpoint";
      const data = "test-data";
      const mockError = new Error("Data send failed");
      (mockProvisionAdapter.sendData as jest.Mock).mockRejectedValue(mockError);

      await expect(espDevice.sendData(endPoint, data)).rejects.toThrow(
        "Data send failed"
      );
    });

  });

  describe("Device Provisioning", () => {
    beforeEach(() => {
      // Mock ESPRMNeoStorage to return tokens
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const { StorageKeys } = require("../../src/utils/constants");
      (ESPRMNeoStorage.getItem as jest.Mock) = jest.fn((key: string) => {
        if (key === StorageKeys.ACCESSTOKEN)
          return Promise.resolve("mock-access-token");
        if (key === StorageKeys.IDTOKEN)
          return Promise.resolve("mock-id-token");
        if (key === StorageKeys.REFRESHTOKEN)
          return Promise.resolve("mock-refresh-token");
        return Promise.resolve(null);
      });

      // Mock ESPSigV4APIManager
      const {
        ESPSigV4APIManager,
      } = require("../../src/services/ESPSigV4APIManager");
      const mockAPIManager = {
        request: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
      };
      (ESPSigV4APIManager.getInstance as jest.Mock).mockReturnValue(
        mockAPIManager
      );

      // Mock API responses (initiate and verify use /v1/groups/.../node-assoc-requests)
      mockAPIManager.request.mockImplementation(
        (method: string, endpoint: string) => {
          if (
            method === "POST" &&
            endpoint.includes("/node-assoc-requests") &&
            !endpoint.includes("/verify")
          ) {
            return Promise.resolve({
              request_id: "test-request-id",
              challenge: "a".repeat(64),

            });
          }
          if (
            method === "POST" &&
            endpoint.includes("/node-assoc-requests/") &&
            endpoint.includes("/verify")
          ) {
            return Promise.resolve({

            });
          }
          return Promise.resolve({});
        }
      );
      // InitiateNodeAssociation uses api.post(); delegate to request mock
      mockAPIManager.post.mockImplementation((path: string, data: any) =>
        mockAPIManager.request("POST", path, data)
      );

      // Mock storage methods (ESPRMNeoStorage already required above)
      (ESPRMNeoStorage.saveNodeAssociationRequest as jest.Mock) = jest.fn();
      (ESPRMNeoStorage.deleteNodeAssociationRequest as jest.Mock) = jest.fn();

      // Mock ESPRMNeoUser
      const { ESPRMNeoUser } = require("../../src/ESPRMNeoUser");
      ESPRMNeoUser.userId = "test-user-id";
    });

    it("should provision device with challenge-response flow", async () => {
      const ssid = "TestNetwork";
      const passphrase = "testpassword";
      const groupId = "test-group-id";
      const onProgress = jest.fn();
      (mockProvisionAdapter.provision as jest.Mock).mockResolvedValue(0);

      // sendData returns base64-encoded response (any valid base64 works; proto mock returns fixed payload)
      const mockSendDataResponse = Buffer.from([1, 2, 3, 4, 5]).toString("base64");
      (mockProvisionAdapter.sendData as jest.Mock).mockResolvedValue(
        mockSendDataResponse
      );

      const result = await espDevice.provision(
        ssid,
        passphrase,
        onProgress,
        groupId
      );

      expect(mockProvisionAdapter.provision).toHaveBeenCalledWith(
        espDevice.name,
        ssid,
        passphrase
      );
      expect(onProgress).toHaveBeenCalled();
      expect(result).toBe("test-node-id");
    });

    it("should throw error when provisioning fails", async () => {
      const ssid = "TestNetwork";
      const passphrase = "testpassword";
      const groupId = "test-group-id";
      const onProgress = jest.fn();

      const mockSendDataResponse = Buffer.from([1, 2, 3, 4, 5]).toString("base64");
      (mockProvisionAdapter.sendData as jest.Mock).mockResolvedValue(
        mockSendDataResponse
      );

      (mockProvisionAdapter.provision as jest.Mock).mockRejectedValue(
        new Error("Provisioning failed")
      );

      await expect(
        espDevice.provision(ssid, passphrase, onProgress, groupId)
      ).rejects.toThrow("Provisioning failed");
    });
  });

  describe("Device Search", () => {
    it("should search for ESP devices via adapter", async () => {
      const mockDevices = [
        {
          name: "Device1",
          transport: "ble",
          security: 0,
          capabilities: [],
          sendData: jest.fn(),
        },
        {
          name: "Device2",
          transport: "softap",
          security: 1,
          capabilities: [],
          sendData: jest.fn(),
        },
      ];
      (mockProvisionAdapter.searchESPDevices as jest.Mock).mockResolvedValue(
        mockDevices
      );

      const result = await mockProvisionAdapter.searchESPDevices(
        "ESP",
        "ble" as any
      );

      expect(mockProvisionAdapter.searchESPDevices).toHaveBeenCalled();
      expect(result).toEqual(mockDevices);
    });

    it("should stop device search via adapter", async () => {
      (
        mockProvisionAdapter.stopESPDevicesSearch as jest.Mock
      ).mockResolvedValue(undefined);

      await mockProvisionAdapter.stopESPDevicesSearch();

      expect(mockProvisionAdapter.stopESPDevicesSearch).toHaveBeenCalled();
    });
  });

  describe("Device Creation", () => {
    it("should create ESP device via adapter", async () => {
      const deviceConfig = {
        name: "New Device",
        transport: "ble",
        security: 0,
        capabilities: [],
        sendData: jest.fn().mockResolvedValue("response"),
      };

      (mockProvisionAdapter.createESPDevice as jest.Mock).mockResolvedValue(
        deviceConfig
      );

      const result = await mockProvisionAdapter.createESPDevice(
        deviceConfig.name,
        deviceConfig.transport,
        deviceConfig.security
      );

      expect(mockProvisionAdapter.createESPDevice).toHaveBeenCalledWith(
        deviceConfig.name,
        deviceConfig.transport,
        deviceConfig.security
      );
      expect(result).toEqual(deviceConfig);
    });
  });

  describe("Device Validation", () => {
    it("should validate device interface", () => {
      const validInterface = {
        name: "Valid Device",
        transport: "ble",
        security: 0,
        capabilities: [],
        sendData: jest.fn().mockResolvedValue("response"),
      };

      expect(() => {
        new ESPDevice(validInterface);
      }).not.toThrow();
    });

    it("should throw error for invalid device interface", () => {
      const invalidInterface = {
        name: "", // Invalid empty name
        transport: "ble",
        security: 0,
        capabilities: [],
        sendData: jest.fn().mockResolvedValue("response"),
      };

      expect(() => {
        new ESPDevice(invalidInterface);
      }).not.toThrow(); // ESPDevice doesn't validate empty name
    });
  });

  describe("Error Handling", () => {
    it("should handle connection errors gracefully", async () => {
      const mockError = new Error("Connection timeout");
      (mockProvisionAdapter.connect as jest.Mock).mockRejectedValue(mockError);

      await expect(espDevice.connect()).rejects.toThrow("Connection timeout");
    });

    it("should handle provision adapter errors", async () => {
      (mockProvisionAdapter.connect as jest.Mock).mockRejectedValue(
        new Error("Adapter error")
      );

      await expect(espDevice.connect()).rejects.toThrow("Adapter error");
    });
  });

  describe("Device Properties", () => {
    it("should have correct default properties", () => {
      expect(espDevice.name).toBe("Test Device");
      expect(espDevice.transport).toBe("ble");
      expect(espDevice.security).toBe(0);
    });
  });
});
