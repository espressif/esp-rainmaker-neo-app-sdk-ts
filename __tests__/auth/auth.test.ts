/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for ESPRMNeoAuth statics: construction and getRefreshedTokens.
 *
 * ★ Runs on the shared SDK test harness: the token-refresh flow goes through
 * `h.userApi.postUserApi`.
 */

// Unmock ESPRMNeoAuth to use the real implementation with static methods
// (it is class-mocked globally in setup.ts).
jest.unmock("../../src/ESPRMNeoAuth");

import { ESPRMNeoAuth } from "../../src/ESPRMNeoAuth";
import { ESPRMNeoBaseConfig } from "../../src/types/input";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";

const h = setupSdkTest();

describe("ESPRMNeoAuth", () => {
  const mockConfig: ESPRMNeoBaseConfig = {
    baseUrl: "https://test.example.com",
    userApiBase: "https://test.example.com",
    awsRegion: "us-east-1",
    userPoolId: "us-east-1_testpool",
    clientId: "test_client_id_123",
    identityId: "test_identity_id_456",
    iotEndpoint: "test.iot.endpoint.com",
  } as ESPRMNeoBaseConfig;

  describe("constructor", () => {
    it("should create instance with config", () => {
      const authInstance = new ESPRMNeoAuth(mockConfig);

      expect(authInstance).toBeInstanceOf(ESPRMNeoAuth);
      expect(authInstance.getConfig()).toEqual(mockConfig);
    });
  });

  describe("getRefreshedTokens", () => {
    const mockRefreshToken = "mock-refresh-token-123";
    const mockAccessToken = "mock-access-token-456";
    const mockIdToken = "mock-id-token-789";

    const mockRotatedRefreshToken = "mock-rotated-refresh-token-000";

    it("returns the rotated refresh token from the response", async () => {
      // The backend spends the presented refresh token and issues a new one;
      // returning the presented token would make the next refresh a replay.
      h.userApi.postUserApi.mockResolvedValue({
        access_token: mockAccessToken,
        id_token: mockIdToken,
        refresh_token: mockRotatedRefreshToken,
      });

      const result = await ESPRMNeoAuth.getRefreshedTokens(mockRefreshToken);

      expect(h.userApi.postUserApi).toHaveBeenCalledWith(
        "/v1/user/auth/token/refresh",
        { refresh_token: mockRefreshToken }
      );
      expect(result).toEqual({
        accessToken: mockAccessToken,
        idToken: mockIdToken,
        refreshToken: mockRotatedRefreshToken,
      });
      expect(result.refreshToken).not.toBe(mockRefreshToken);
    });

    it.each([
      ["absent", {}],
      ["empty string", { refresh_token: "" }],
      ["null", { refresh_token: null }],
    ])(
      "falls back to the presented refresh token when the response has none (%s)",
      async (_name, extra) => {
        h.userApi.postUserApi.mockResolvedValueOnce({
          access_token: mockAccessToken,
          id_token: mockIdToken,
          ...extra,
        });

        const result = await ESPRMNeoAuth.getRefreshedTokens(mockRefreshToken);

        expect(result).toEqual({
          accessToken: mockAccessToken,
          idToken: mockIdToken,
          refreshToken: mockRefreshToken,
        });
      }
    );

    it("should throw error when refresh fails", async () => {
      h.userApi.postUserApi.mockRejectedValueOnce(
        new Error("Failed to refresh session")
      );

      await expect(
        ESPRMNeoAuth.getRefreshedTokens(mockRefreshToken)
      ).rejects.toThrow("Failed to refresh session");
    });

    it.each([
      ["missing access token", { id_token: "id" }],
      ["missing id token", { access_token: "acc" }],
      ["null tokens", { access_token: null, id_token: null }],
      ["empty response", {}],
    ])("should reject an incomplete token response (%s)", async (_name, body) => {
      h.userApi.postUserApi.mockResolvedValueOnce(body);

      await expect(
        ESPRMNeoAuth.getRefreshedTokens(mockRefreshToken)
      ).rejects.toThrow("Failed to refresh session");
    });

    it.each([["Network error"], ["Service Unavailable"], ["AWS SDK error"]])(
      "propagates transport/service failures (%s)",
      async (message) => {
        h.userApi.postUserApi.mockRejectedValueOnce(new Error(message));

        await expect(
          ESPRMNeoAuth.getRefreshedTokens(mockRefreshToken)
        ).rejects.toThrow(message);
      }
    );
  });
});
