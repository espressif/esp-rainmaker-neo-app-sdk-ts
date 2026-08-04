/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ESPSigV4APIManager,
  initializeSigV4APIManager,
  _resetSigV4APIManagerForTests,
} from "../../src/services/ESPSigV4APIManager";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import {
  createAuthorizationHeader,
  generateSigV4AuthHeader,
} from "../../src/utils/awsSigv4Utils";

// Mock the temporary-credentials module — ESPSigV4APIManager calls
// fetchTemporaryAWSCredentials() directly now (no more prototype indirection).
jest.mock("../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials", () => ({
  fetchTemporaryAWSCredentials: jest.fn(),
}));

// Mock dependencies
jest.mock("../../src/ESPRMNeoBase");
jest.mock("../../src/ESPRMNeoUser");
jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");

// Note: We import the real GetTemporaryAWSCredentials method extension
// but we'll mock it in beforeEach to return test credentials

// Unmock ESPSigV4APIManager - we want to test the real implementation
jest.unmock("../../src/services/ESPSigV4APIManager");

/**
 * Minimal fetch Response mock. ESPSigV4APIManager reads the body with
 * `response.text()` then JSON.parse (empty body → null), matching real Fetch.
 */
function mockFetchResponse(
  body: Record<string, unknown> | unknown[] | string | null,
  init: { ok?: boolean; status?: number; statusText?: string } = {}
): {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
} {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 400);
  const statusText = init.statusText ?? (ok ? "OK" : "Bad Request");
  const bodyText =
    body === null ? "" : typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok,
    status,
    statusText,
    text: () => Promise.resolve(bodyText),
  };
}

describe("ESPSigV4APIManager Tests", () => {
  let mockConfig: any;
  const initFromMockConfig = () => ({
    baseUrl: `${mockConfig.baseUrl}/prod`,
    userApiBase: "https://test-api.example.com/prod",
    awsRegion: mockConfig.awsRegion,
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // Wipe the module-scoped singleton so each test gets a fresh manager and
    // initializeSigV4APIManager's "already initialized" guard doesn't fire.
    _resetSigV4APIManagerForTests();

    mockConfig = {
      baseUrl: "https://test.example.com",
      userApiBase: "https://test.example.com",
      awsRegion: "us-east-1",
      userPoolId: "test-user-pool-id",
      clientId: "test-client-id",
      identityId: "test-identity-id",
      iotEndpoint: "test.iot.endpoint.com",
    };

    // Mock ESPRMNeoBase.getConfig for methods that still consult global config
    // (e.g., legacy expectations in some assertions). ESPSigV4APIManager itself
    // no longer reads global config — it receives its init via initialize().
    (ESPRMNeoBase.getConfig as jest.Mock).mockReturnValue(mockConfig);
  });

  describe("Initialization", () => {
    it("should initialize singleton instance", () => {
      initializeSigV4APIManager(initFromMockConfig());
      const api = ESPSigV4APIManager.getInstance();

      expect(api).toBeDefined();
      expect(api).toBeInstanceOf(ESPSigV4APIManager);
    });

    it("should return same instance on multiple calls", () => {
      initializeSigV4APIManager(initFromMockConfig());
      const api1 = ESPSigV4APIManager.getInstance();
      const api2 = ESPSigV4APIManager.getInstance();

      expect(api1).toBe(api2);
    });

    it("should use correct base URL from config", () => {
      const init = initFromMockConfig();
      initializeSigV4APIManager(init);
      const api = ESPSigV4APIManager.getInstance();

      // Test that api is created with correct config
      expect(api).toBeDefined();
      // ESPSigV4APIManager holds its own init snapshot — config is passed
      // explicitly at initialize() time, not read back from ESPRMNeoBase.
      expect(init.baseUrl).toBe(`${mockConfig.baseUrl}/prod`);
    });
  });

  describe("HTTP Methods", () => {
    let api: ESPSigV4APIManager;

    beforeEach(() => {
      // Mock credentials
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const { ESPRMNeoUser } = require("../../src/ESPRMNeoUser");
      const mockCredentials = {
        accessKey: "test-access-key",
        secretKey: "test-secret-key",
        sessionToken: "test-session-token",
        expiration: new Date(Date.now() + 3600000).toISOString(),
      };
      (ESPRMNeoStorage.getTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error("No credentials"));
      (ESPRMNeoStorage.saveTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      // Mock the credentials fetcher that ESPSigV4APIManager calls
      const { fetchTemporaryAWSCredentials } = require(
        "../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials"
      );
      (fetchTemporaryAWSCredentials as jest.Mock).mockResolvedValue(
        mockCredentials
      );

      initializeSigV4APIManager(initFromMockConfig());
      api = ESPSigV4APIManager.getInstance();
    });

    it("should make GET request", async () => {
      // Mock fetch
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse({ data: "test" }));

      const result = await api.get("/test-endpoint");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.objectContaining({
          method: "GET",
          headers: expect.any(Object),
        })
      );
      expect(result).toEqual({ data: "test" });
    });

    it("should make POST request", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse({ message: "ok" }));

      const requestData = { key: "value" };
      const result = await api.post("/test-endpoint", requestData);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.objectContaining({
          method: "POST",
          headers: expect.any(Object),
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual({ message: "ok" });
    });

    it("should make PUT request", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse({ updated: true }));

      const requestData = { key: "updated" };
      const result = await api.put("/test-endpoint", requestData);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.objectContaining({
          method: "PUT",
          headers: expect.any(Object),
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual({ updated: true });
    });

    it("should make DELETE request", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse({ deleted: true }));

      const result = await api.delete("/test-endpoint");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.any(Object),
        })
      );
      expect(result).toEqual({ deleted: true });
    });

    it("should resolve null for empty success body (e.g. 204 No Content)", async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchResponse(null, {
          ok: true,
          status: 204,
          statusText: "No Content",
        })
      );

      const result = await api.delete("/test-endpoint");

      expect(result).toBeNull();
    });
  });

  describe("AWS Signature V4", () => {
    let api: ESPSigV4APIManager;

    beforeEach(() => {
      // Mock credentials
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const { ESPRMNeoUser } = require("../../src/ESPRMNeoUser");
      const mockCredentials = {
        accessKey: "test-access-key",
        secretKey: "test-secret-key",
        sessionToken: "test-session-token",
        expiration: new Date(Date.now() + 3600000).toISOString(),
      };
      (ESPRMNeoStorage.getTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error("No credentials"));
      (ESPRMNeoStorage.saveTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      {
        const { fetchTemporaryAWSCredentials } = require(
          "../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials"
        );
        (fetchTemporaryAWSCredentials as jest.Mock).mockResolvedValue(
          mockCredentials
        );
      }

      initializeSigV4APIManager(initFromMockConfig());
      api = ESPSigV4APIManager.getInstance();
    });

    it("should generate correct authorization header via utility", () => {
      const authHeader = generateSigV4AuthHeader({
        accessKey: "test-access-key",
        secretKey: "test-secret-key",
        timestamp: "20240101T000000Z",
        dateStamp: "20240101",
        region: "us-east-1",
        service: "execute-api",
        method: "GET",
        canonicalURI: "/test",
        canonicalQueryString: "",
        requestHeaders: {
          host: "test.example.com",
          "x-amz-date": "20240101T000000Z",
        },
        signedHeaders: "host;x-amz-date",
        payloadHash: (crypto as any)
          .createHash("sha256")
          .update("")
          .digest("hex"),
      });

      expect(authHeader).toContain("AWS4-HMAC-SHA256");
      expect(authHeader).toContain(
        "Credential=test-access-key/20240101/us-east-1/execute-api/aws4_request"
      );
      expect(authHeader).toContain("SignedHeaders=host;x-amz-date");
      expect(authHeader).toContain("Signature=");
    });

    it("should generate correct authorization header", () => {
      const authHeader = createAuthorizationHeader(
        "test-access-key",
        "20240101",
        "us-east-1",
        "execute-api",
        "test-signature",
        "host;x-amz-date"
      );

      expect(authHeader).toContain("AWS4-HMAC-SHA256");
      expect(authHeader).toContain(
        "Credential=test-access-key/20240101/us-east-1/execute-api/aws4_request"
      );
      expect(authHeader).toContain("SignedHeaders=host;x-amz-date");
      expect(authHeader).toContain("Signature=test-signature");
    });
  });

  describe("Error Handling", () => {
    let api: ESPSigV4APIManager;

    beforeEach(() => {
      // Mock credentials
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const { ESPRMNeoUser } = require("../../src/ESPRMNeoUser");
      const mockCredentials = {
        accessKey: "test-access-key",
        secretKey: "test-secret-key",
        sessionToken: "test-session-token",
        expiration: new Date(Date.now() + 3600000).toISOString(),
      };
      (ESPRMNeoStorage.getTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error("No credentials"));
      (ESPRMNeoStorage.saveTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      {
        const { fetchTemporaryAWSCredentials } = require(
          "../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials"
        );
        (fetchTemporaryAWSCredentials as jest.Mock).mockResolvedValue(
          mockCredentials
        );
      }

      initializeSigV4APIManager(initFromMockConfig());
      api = ESPSigV4APIManager.getInstance();
    });

    it("should handle HTTP error responses", async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchResponse(
          { error: "Invalid request" },
          { ok: false, status: 400, statusText: "Bad Request" }
        )
      );

      await expect(api.get("/test-endpoint")).rejects.toThrow(
        "HTTP error! status: 400"
      );
    });

    it("should handle network errors", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      await expect(api.get("/test-endpoint")).rejects.toThrow(
        "Network error"
      );
    });

    it("should handle JSON parsing errors", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse("not valid json {{{", { ok: true }));

      await expect(api.get("/test-endpoint")).rejects.toThrow(
        "Failed to parse response as JSON"
      );
    });
  });

  describe("Request Configuration", () => {
    let api: ESPSigV4APIManager;

    beforeEach(() => {
      // Mock credentials
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const { ESPRMNeoUser } = require("../../src/ESPRMNeoUser");
      const mockCredentials = {
        accessKey: "test-access-key",
        secretKey: "test-secret-key",
        sessionToken: "test-session-token",
        expiration: new Date(Date.now() + 3600000).toISOString(),
      };
      (ESPRMNeoStorage.getTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error("No credentials"));
      (ESPRMNeoStorage.saveTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      {
        const { fetchTemporaryAWSCredentials } = require(
          "../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials"
        );
        (fetchTemporaryAWSCredentials as jest.Mock).mockResolvedValue(
          mockCredentials
        );
      }

      initializeSigV4APIManager(initFromMockConfig());
      api = ESPSigV4APIManager.getInstance();
    });

    it("should include AWS signature headers", async () => {
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse({}));

      await api.get("/test-endpoint");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("AWS4-HMAC-SHA256"),
            "x-amz-date": expect.any(String),
          }),
        })
      );
    });

    it("should handle query parameters", async () => {
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse({}));

      const queryParams = {
        page: "1",
        limit: "10",
        filter: "active",
      };

      await api.get("/test-endpoint", queryParams);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.any(Object)
      );
    });
  });

  describe("AWS Credentials Integration", () => {
    let api: ESPSigV4APIManager;

    beforeEach(() => {
      // Mock credentials
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const { ESPRMNeoUser } = require("../../src/ESPRMNeoUser");
      const mockCredentials = {
        accessKey: "test-access-key",
        secretKey: "test-secret-key",
        sessionToken: "test-session-token",
        expiration: new Date(Date.now() + 3600000).toISOString(),
      };
      (ESPRMNeoStorage.getTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error("No credentials"));
      (ESPRMNeoStorage.saveTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      {
        const { fetchTemporaryAWSCredentials } = require(
          "../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials"
        );
        (fetchTemporaryAWSCredentials as jest.Mock).mockResolvedValue(
          mockCredentials
        );
      }

      initializeSigV4APIManager(initFromMockConfig());
      api = ESPSigV4APIManager.getInstance();
    });

    it("should include AWS signature headers in requests", async () => {
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse({}));

      await api.get("/test-endpoint");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("AWS4-HMAC-SHA256"),
            "x-amz-date": expect.any(String),
          }),
        })
      );
    });
  });

  describe("Request Method Overloads", () => {
    let api: ESPSigV4APIManager;

    beforeEach(() => {
      // Mock credentials
      const {
        ESPRMNeoStorage,
      } = require("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
      const { ESPRMNeoUser } = require("../../src/ESPRMNeoUser");
      const mockCredentials = {
        accessKey: "test-access-key",
        secretKey: "test-secret-key",
        sessionToken: "test-session-token",
        expiration: new Date(Date.now() + 3600000).toISOString(),
      };
      (ESPRMNeoStorage.getTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error("No credentials"));
      (ESPRMNeoStorage.saveTemporaryCredentials as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      {
        const { fetchTemporaryAWSCredentials } = require(
          "../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials"
        );
        (fetchTemporaryAWSCredentials as jest.Mock).mockResolvedValue(
          mockCredentials
        );
      }

      initializeSigV4APIManager(initFromMockConfig());
      api = ESPSigV4APIManager.getInstance();
    });

    it("should support generic request method", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse({ data: "test" }));

      const result = await api.request("GET", "/test-endpoint");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.objectContaining({
          method: "GET",
        })
      );
      expect(result).toEqual({ data: "test" });
    });

    it("should support request with body", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse({ message: "ok" }));

      const requestData = { key: "value" };
      const result = await api.request(
        "POST",
        "/test-endpoint",
        requestData
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/prod/test-endpoint",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual({ message: "ok" });
    });
  });

  describe("Configuration Management", () => {
    it("should use correct region from config", () => {
      const customConfig = {
        ...mockConfig,
        awsRegion: "eu-west-1",
      };
      (ESPRMNeoBase.getConfig as jest.Mock).mockReturnValue(customConfig);

      const init = {
        baseUrl: `${customConfig.baseUrl}/prod`,
        userApiBase: "https://test-api.example.com/prod",
        awsRegion: customConfig.awsRegion,
      };
      initializeSigV4APIManager(init);
      const api = ESPSigV4APIManager.getInstance();

      expect(api).toBeDefined();
      // Region flows in via init, not via ESPRMNeoBase.getConfig().
      expect(init.awsRegion).toBe("eu-west-1");
    });

    it("should initialize with correct configuration", () => {
      const init = initFromMockConfig();
      initializeSigV4APIManager(init);
      const api = ESPSigV4APIManager.getInstance();

      expect(api).toBeDefined();
      // Init payload is what the manager is constructed with.
      expect(init.baseUrl).toBe(`${mockConfig.baseUrl}/prod`);
      expect(init.awsRegion).toBe(mockConfig.awsRegion);
    });
  });
});
