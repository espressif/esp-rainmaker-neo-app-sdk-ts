/// <reference types="jest" />

import { ESPDevice } from "../../src/ESPDevice";
import {
  ESPDeviceInterface,
  ESPProvResponseStatus,
  ESPWifiList,
} from "../../src/types/provision";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPRMNeoStorage } from "../../src/services/ESPRMNeoStorage/ESPRMNeoStorage";
import { ESPSigV4APIManager } from "../../src/services/ESPSigV4APIManager";
import { ESPProvError } from "../../src/utils/error/ESPProvError";
import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { ProvErrorCodes } from "../../src/utils/constants";

// Load ESPDevice method extensions
import "../../src/methods/ESPDevice";

// Mock dependencies
jest.mock("../../src/ESPRMNeoBase");
jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
// Unmock ESPProvError to use the real implementation
jest.unmock("../../src/utils/error/ESPProvError");
jest.mock("../../src/utils/constants", () => {
  const actual = jest.requireActual("../../src/utils/constants");
  return {
    ...actual,
    StorageKeys: {
      IDTOKEN: "id_token",
    },
    ErrorLabels: {
      ESPProvError: "ESPProvError",
    },
    ProvErrorCodes: {
      FAILED_USER_DEVICE_ASSOCIATION: "FAILED_USER_DEVICE_ASSOCIATION",
      FAILED_PROV: "FAILED_PROV",
      MISSING_ID_TOKEN: "MISSING_ID_TOKEN",
      MISSING_NODE_ID: "MISSING_NODE_ID",
    },
    Endpoint: {
      CHALLENGE_RESPONSE: "ch_resp",
    },
    ESPProvProgressMessages: {
      START_ASSOCIATION: "Starting association...",
      INITIATING_NODE_ASSOCIATION: "Initiating node association...",
      SENDING_CHALLENGE_TO_DEVICE: "Sending challenge to device...",
      VERIFYING_NODE_ASSOCIATION: "Verifying node association...",
      SETTING_NETWORK_CREDENTIALS: "Setting network credentials...",
      SENDING_ASSOCIATION_CONFIG: "Sending association config...",
      ASSOCIATION_CONFIG_SENT: "Association config sent...",
      USER_NODE_MAPPING_SUCCEED: "User node mapping succeeded...",
      DECODING_RESPONSE_DATA: "Decoding response data...",
      DEVICE_PROVISIONED: "Device provisioned successfully",
      DECODED_NODE_ID: "Node ID decoded successfully",
    },
  };
});

// Mock React Native NativeModules
jest.mock("react-native", () => ({
  NativeModules: {
    ESPProvModule: {},
  },
}));

// Mock protobuf classes
jest.mock("../../src/proto/esp_rmaker_user_mapping", () => ({
  rainmaker: {
    CmdSetUserMapping: class MockCmdSetUserMapping {
      SecretKey = "";
      UserID = "";
    },
    RMakerConfigPayload: class MockRMakerConfigPayload {
      msg = 0;
      cmd_set_user_mapping = null;
      resp_set_user_mapping = null;
      serialize() {
        return new Uint8Array();
      }
      static deserialize() {
        return { resp_set_user_mapping: { Status: 0, NodeId: "test-node-id" } };
      }
    },
    RMakerConfigMsgType: {
      TypeCmdSetUserMapping: 1,
    },
    RMakerConfigStatus: {
      Success: 0,
    },
  },
}));

jest.mock("../../src/proto/esp_rmaker_chal_resp", () => {
  const RMakerMiscMsgType = {
    TypeCmdChallengeResponse: 1,
    TypeCmdGetNodeID: 2,
  };

  const RMakerMiscStatus = {
    Success: 0,
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

describe("ESPDevice", () => {
  const mockDeviceConfig: ESPDeviceInterface = {
    name: "test-device",
    transport: "wifi",
    security: 1,
  };

  const mockProvisionAdapter = {
    searchESPDevices: jest.fn(),
    stopESPDevicesSearch: jest.fn(),
    createESPDevice: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    getDeviceCapabilities: jest.fn(),
    getDeviceVersion: jest.fn(),
    scanWifiList: jest.fn(),
    provision: jest.fn(),
    setProofOfPossession: jest.fn(),
    sendData: jest.fn(),
    initializeSession: jest.fn(),
  };

  let device: ESPDevice;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup ESPRMNeoBase mock — the class is jest.mock'd; wire the adapter getter.
    (ESPRMNeoBase.getProvisionAdapter as jest.Mock).mockReturnValue(
      mockProvisionAdapter
    );

    // Setup ESPRMNeoStorage mock for NodeMappingHelper (provision flow)
    const { StorageKeys } = require("../../src/utils/constants");
    (ESPRMNeoStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === StorageKeys.ACCESSTOKEN)
        return Promise.resolve("mock-access-token");
      if (key === StorageKeys.IDTOKEN) return Promise.resolve("mock-id-token");
      if (key === StorageKeys.REFRESHTOKEN)
        return Promise.resolve("mock-refresh-token");
      return Promise.resolve(null);
    });

    // Setup ESPRMNeoUser mock
    (ESPRMNeoUser as any).userId = "test-user-id";

    // Setup ESPSigV4APIManager mock
    const mockAPIManager = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn().mockResolvedValue({
        request_id: "test-request-id",
        challenge: "a".repeat(64),
      }),
      put: jest.fn(),
      delete: jest.fn(),
    };
    (ESPSigV4APIManager.getInstance as jest.Mock).mockReturnValue(
      mockAPIManager
    );

    // Setup sendData mock for provision challenge-response flow
    mockProvisionAdapter.sendData.mockResolvedValue(
      Buffer.from([1, 2, 3, 4, 5]).toString("base64")
    );

    device = new ESPDevice(mockDeviceConfig);
  });

  describe("constructor", () => {
    it("should create device with correct configuration", () => {
      expect(device.name).toBe("test-device");
      expect(device.transport).toBe("wifi");
      expect(device.security).toBe(1);
    });

    it("should set ESPProvisionAdapter from ESPRMNeoBase", () => {
      expect(device.ESPProvisionAdapter).toBe(mockProvisionAdapter);
    });
  });

  describe("connect", () => {
    it("should connect to device successfully", async () => {
      mockProvisionAdapter.connect.mockResolvedValue(0);

      const result = await device.connect();

      expect(mockProvisionAdapter.connect).toHaveBeenCalledWith("test-device");
      expect(result).toBe(0);
    });

    it("should handle connection errors", async () => {
      mockProvisionAdapter.connect.mockRejectedValue(
        new Error("Connection failed")
      );

      await expect(device.connect()).rejects.toThrow("Connection failed");
    });
  });

  describe("disconnect", () => {
    it("should disconnect from device successfully", async () => {
      mockProvisionAdapter.disconnect.mockResolvedValue({

      });

      const result = await device.disconnect();
      expect(result).toMatchObject({});
      expect(mockProvisionAdapter.disconnect).toHaveBeenCalledWith(
        "test-device"
      );
    });
  });

  describe("getDeviceCapabilities", () => {
    it("should get device capabilities successfully", async () => {
      const mockCapabilities = ["wifi", "ble"];
      mockProvisionAdapter.getDeviceCapabilities.mockResolvedValue(
        mockCapabilities
      );

      const result = await device.getDeviceCapabilities();

      expect(mockProvisionAdapter.getDeviceCapabilities).toHaveBeenCalledWith(
        "test-device"
      );
      expect(result).toEqual(mockCapabilities);
    });
  });

  describe("getDeviceVersion", () => {
    it("should get device version successfully", async () => {
      const mockVersion = { version: "1.0.0" };
      mockProvisionAdapter.getDeviceVersion.mockResolvedValue(mockVersion);

      const result = await device.getDeviceVersion();

      expect(mockProvisionAdapter.getDeviceVersion).toHaveBeenCalledWith(
        "test-device"
      );
      expect(result).toEqual(mockVersion);
    });
  });

  describe("scanWifiList", () => {
    it("should scan wifi list successfully", async () => {
      const mockWifiList: ESPWifiList[] = [
        { ssid: "Network1", rssi: -50, auth: 0 },
        { ssid: "Network2", rssi: -60, auth: 1 },
      ];
      mockProvisionAdapter.scanWifiList.mockResolvedValue(mockWifiList);

      const result = await device.scanWifiList();

      expect(mockProvisionAdapter.scanWifiList).toHaveBeenCalledWith(
        "test-device"
      );
      expect(result).toEqual(mockWifiList);
    });
  });

  describe("provision", () => {
    const mockOnProgress = jest.fn();
    const ssid = "TestNetwork";
    const passphrase = "TestPassword";
    const groupId = "test-group-id";

    beforeEach(() => {
      mockProvisionAdapter.provision.mockResolvedValue(0);
    });

    it("should provision device successfully with challenge-response flow", async () => {
      const result = await device.provision(
        ssid,
        passphrase,
        mockOnProgress,
        groupId
      );

      expect(mockOnProgress).toHaveBeenCalledWith({
        status: ESPProvResponseStatus.onProgress,
        description: "Initiating node association...",
      });
      expect(mockProvisionAdapter.provision).toHaveBeenCalledWith(
        "test-device",
        ssid,
        passphrase
      );
      expect(result).toBe("test-node-id");
    });

    it("should handle provision failure", async () => {
      mockProvisionAdapter.provision.mockRejectedValue(
        new Error("Provisioning failed")
      );

      await expect(
        device.provision(ssid, passphrase, mockOnProgress, groupId)
      ).rejects.toThrow();
    });

    it("should call progress callback during provision", async () => {
      await device.provision(ssid, passphrase, mockOnProgress, groupId);

      expect(mockOnProgress).toHaveBeenCalled();
    });
  });

  describe("setProofOfPossession", () => {
    it("should set proof of possession successfully", async () => {
      const proof = "test-proof";
      mockProvisionAdapter.setProofOfPossession.mockResolvedValue(true);

      const result = await device.setProofOfPossession(proof);

      expect(mockProvisionAdapter.setProofOfPossession).toHaveBeenCalledWith(
        "test-device",
        proof
      );
      expect(result).toBe(true);
    });
  });

  describe("sendData", () => {
    it("should send data successfully", async () => {
      const endpoint = "test-endpoint";
      const data = "test-data";
      const response = "test-response";
      mockProvisionAdapter.sendData.mockResolvedValue(response);

      const result = await device.sendData(endpoint, data);

      expect(mockProvisionAdapter.sendData).toHaveBeenCalledWith(
        "test-device",
        endpoint,
        data
      );
      expect(result).toBe(response);
    });
  });

  describe("initializeSession", () => {
    it("should initialize session successfully", async () => {
      mockProvisionAdapter.initializeSession.mockResolvedValue(true);

      const result = await device.initializeSession();

      expect(mockProvisionAdapter.initializeSession).toHaveBeenCalledWith(
        "test-device"
      );
      expect(result).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle ESPProvError correctly", async () => {
      const { ProvisionType } = require("../../src/utils/constants");
      const mockError = new ESPProvError(ProvErrorCodes.FAILED_PROV);
      mockProvisionAdapter.provision.mockRejectedValue(mockError);

      const mockOnProgress = jest.fn();

      await expect(
        device.provision("ssid", "pass", mockOnProgress, "default")
      ).rejects.toThrow();
    });

    it("should handle generic errors correctly", async () => {
      const genericError = new Error("Generic error");
      mockProvisionAdapter.connect.mockRejectedValue(genericError);

      await expect(device.connect()).rejects.toThrow("Generic error");
    });
  });

  describe("edge cases", () => {
    it("should handle null device name gracefully", () => {
      const deviceWithNullName = new ESPDevice({
        ...mockDeviceConfig,
        name: null as any,
      });
      expect(deviceWithNullName.name).toBeNull();
    });

    it("should handle undefined transport gracefully", () => {
      const deviceWithUndefinedTransport = new ESPDevice({
        ...mockDeviceConfig,
        transport: undefined as any,
      });
      expect(deviceWithUndefinedTransport.transport).toBeUndefined();
    });

    it("should handle zero security value", () => {
      const deviceWithZeroSecurity = new ESPDevice({
        ...mockDeviceConfig,
        security: 0,
      });
      expect(deviceWithZeroSecurity.security).toBe(0);
    });
  });
});
