/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { UserTokensData } from "../../src/types/input";
import { StorageKeys } from "../../src/utils/constants";

// Import GetGroups (needed by MQTT methods)
import "../../src/methods/ESPRMNeoUser/GetGroups";

// Import MQTT method extensions (deprecated methods removed)
import "../../src/methods/ESPRMNeoUser/MQTT";

// Mock dependencies
jest.mock("../../src/ESPRMNeoBase");
// (SigV4 manager is module-mocked globally in setup.ts — the lint ratchet forbids re-mocking here)
jest.mock("../../src/services/ESPRMNeoMqtt/ESPRMNeoMqtt", () => ({
  ESPRMNeoMqtt: {
    getInstance: jest.fn(),
    initialize: jest.fn(),
    clear: jest.fn(),
    hasInstance: jest.fn().mockReturnValue(true),
  },
}));

describe("ESPRMNeoUser MQTT Methods", () => {
  let userInstance: ESPRMNeoUser;
  let mockAPIManager: any;
  let mockMQTTClient: any;
  let mockESPRMNeoMqttInstance: {
    connect: jest.Mock;
    disconnect: jest.Mock;
    isConnected: jest.Mock;
  };

  /** Valid JWT so `isTokenExpired` in GetTemporaryAWSCredentials does not force refresh (mock has no real refresh API). */
  const VALID_TEST_ID_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

  const credentialsFetchResponse = () =>
    JSON.stringify({
      access_key_id: "temp-access-key",
      secret_access_key: "temp-secret-key",
      session_token: "temp-session-token",
    });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    mockESPRMNeoMqttInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockResolvedValue(false),
    };
    const { ESPRMNeoMqtt } = require("../../src/services/ESPRMNeoMqtt/ESPRMNeoMqtt");
    (ESPRMNeoMqtt.getInstance as jest.Mock).mockReturnValue(
      mockESPRMNeoMqttInstance
    );
    (ESPRMNeoMqtt.hasInstance as jest.Mock).mockReturnValue(true);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(credentialsFetchResponse()),
    }) as unknown as typeof fetch;

    // Mock tokens data (ID token must be decodable JWT for getTemporaryAWSCredentials pre-check)
    const mockTokens: UserTokensData = {
      accessToken: "mock-access-token",
      idToken: VALID_TEST_ID_TOKEN,
      refreshToken: "mock-refresh-token",
    };

    // Mock MQTT Client
    mockMQTTClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      publish: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      connected: false,
      reconnecting: false,
    };

    // Mock API Manager
    mockAPIManager = {
      makeRequest: jest.fn(),
      post: jest.fn(),
      request: jest.fn(),
    };

    // Mock ESPRMNeoBase static methods
    (ESPRMNeoBase.getConfig as jest.Mock).mockReturnValue({
      baseUrl: "https://test.example.com",
      userApiBase: "https://test.example.com",
      awsRegion: "us-east-1",
      userPoolId: "test-user-pool-id",
      clientId: "test-client-id",
      identityId: "test-identity-id",
      iotEndpoint: "test.iot.endpoint.amazonaws.com",
    });
    // Mock ESPSigV4APIManager.getInstance directly
    const {
      ESPSigV4APIManager,
    } = require("../../src/services/ESPSigV4APIManager");
    (ESPSigV4APIManager.getInstance as jest.Mock).mockReturnValue(
      mockAPIManager
    );

    // Mock ESPRMNeoStorage static methods
    const {
      ESPRMNeoStorage,
    } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
    (ESPRMNeoStorage.setItem as jest.Mock) = jest.fn();
    (ESPRMNeoStorage.getItem as jest.Mock) = jest.fn((key: string) => {
      if (key === StorageKeys.ACCESSTOKEN) {
        return Promise.resolve("mock-access-token");
      }
      if (key === StorageKeys.IDTOKEN) {
        return Promise.resolve(VALID_TEST_ID_TOKEN);
      }
      if (key === StorageKeys.REFRESHTOKEN) {
        return Promise.resolve("mock-refresh-token");
      }
      return Promise.resolve(null);
    });
    (ESPRMNeoStorage.removeItem as jest.Mock) = jest.fn();
    (ESPRMNeoStorage.saveTemporaryCredentials as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (ESPRMNeoStorage.clearTemporaryCredentials as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (ESPRMNeoStorage.getTemporaryCredentials as jest.Mock) = jest
      .fn()
      .mockResolvedValue(null);

    // Ensure JWT decode mock is set up correctly
    const { decodeToken } = require("../../src/services/ESPRMNeoHelpers/DecodeToken");
    (decodeToken as jest.Mock).mockReturnValue({
      sub: "test-user-id",
      email: "test@example.com",
      "cognito:username": "test@example.com",
    });

    // Create user instance
    userInstance = new ESPRMNeoUser(mockTokens);
  });

  describe("assumeRole", () => {
    it("should successfully assume role without tags", async () => {
      const mockResponse = {
        access_key: "test-access-key",
        secret_key: "test-secret-key",
        session_token: "test-session-token",
      };
      mockAPIManager.post.mockResolvedValue(mockResponse);

      const result = await userInstance.assumeRole(
        "test-access-key",
        "test-secret-key",
        "test-session-token"
      );

      expect(mockAPIManager.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw error when assume role API fails", async () => {
      const mockError = new Error("Assume role failed");
      mockAPIManager.post.mockRejectedValue(mockError);

      await expect(
        userInstance.assumeRole("key", "secret", "token")
      ).rejects.toThrow("Assume role failed");
    });

    it("should throw error when response is missing required fields", async () => {
      const mockResponse = {
        access_key: "test-access-key",
        // Missing secret_key and session_token
      };
      mockAPIManager.post.mockResolvedValue(mockResponse);

      await expect(
        userInstance.assumeRole("key", "secret", "token")
      ).rejects.toThrow(
        "Invalid assume role response: missing required credential fields"
      );
    });

    it("should throw error when response has empty required fields", async () => {
      const mockResponse = {
        access_key: "",
        secret_key: "test-secret-key",
        session_token: "test-session-token",
      };
      mockAPIManager.post.mockResolvedValue(mockResponse);

      await expect(
        userInstance.assumeRole("key", "secret", "token")
      ).rejects.toThrow(
        "Invalid assume role response: missing required credential fields"
      );
    });
  });

  describe("connectMQTT", () => {
    it("should successfully connect to MQTT", async () => {
      mockAPIManager.post.mockResolvedValue({
        access_key: "test-access-key",
        secret_key: "test-secret-key",
        session_token: "test-session-token",
      });

      const result = await userInstance.connectMQTT();

      expect(global.fetch).toHaveBeenCalled();
      expect(mockAPIManager.post).toHaveBeenCalled();
      expect(mockESPRMNeoMqttInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          // Policy scopes iot:Connect to user:<email|phone>:*
          clientId: expect.stringMatching(/^user:test@example\.com:\d{6}$/),
        })
      );
      expect(result).toBe(true);
    });

    it("should throw error when MQTT connection fails", async () => {
      mockAPIManager.post.mockResolvedValue({
        access_key: "test-access-key",
        secret_key: "test-secret-key",
        session_token: "test-session-token",
      });
      mockESPRMNeoMqttInstance.connect.mockRejectedValue(
        new Error("Connection failed")
      );

      await expect(userInstance.connectMQTT()).rejects.toThrow("Connection failed");
    });
  });

  describe("connectMQTT (replaces connectWithAWSCredentials)", () => {
    it("should successfully connect with AWS credentials", async () => {
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      mockAPIManager.post.mockResolvedValue({
        access_key: "test-access-key",
        secret_key: "test-secret-key",
        session_token: "test-session-token",
      });

      await userInstance.connectMQTT();

      expect(ESPRMNeoStorage.getItem).toHaveBeenCalledWith(StorageKeys.IDTOKEN);
      expect(mockESPRMNeoMqttInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          accessKey: "test-access-key",
          secretKey: "test-secret-key",
          sessionToken: "test-session-token",
        })
      );
    });

    it("should throw error when connection with AWS credentials fails", async () => {
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      (ESPRMNeoStorage.getItem as jest.Mock).mockImplementation(() =>
        Promise.resolve(null)
      );

      // ensureValidIdToken runs before postUserCredentials, so with an empty
      // storage the missing ID token is reported first.
      await expect(userInstance.connectMQTT()).rejects.toThrow(
        "Missing ID token - user must be logged in"
      );
    });
  });

  describe("disconnectMQTT", () => {
    it("no-ops when no MQTT instance exists", async () => {
      const { ESPRMNeoMqtt } = require("../../src/services/ESPRMNeoMqtt/ESPRMNeoMqtt");
      (ESPRMNeoMqtt.hasInstance as jest.Mock).mockReturnValue(false);

      await expect(userInstance.disconnectMQTT()).resolves.toBeUndefined();
    });

    it("skips disconnect when already disconnected", async () => {
      mockESPRMNeoMqttInstance.isConnected.mockResolvedValue(false);

      await userInstance.disconnectMQTT();

      expect(mockESPRMNeoMqttInstance.disconnect).not.toHaveBeenCalled();
    });

    it("calls the shared MQTT instance's disconnect when connected", async () => {
      mockESPRMNeoMqttInstance.isConnected.mockResolvedValue(true);

      await userInstance.disconnectMQTT();

      expect(mockESPRMNeoMqttInstance.disconnect).toHaveBeenCalled();
    });

    it("propagates disconnection errors", async () => {
      mockESPRMNeoMqttInstance.isConnected.mockResolvedValue(true);
      mockESPRMNeoMqttInstance.disconnect.mockRejectedValue(
        new Error("Disconnection failed")
      );

      await expect(userInstance.disconnectMQTT()).rejects.toThrow(
        "Disconnection failed"
      );
    });
  });

});
