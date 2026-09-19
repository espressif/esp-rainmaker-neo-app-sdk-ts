/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for the ESPRMNeoUser class itself: constructor token handling,
 * MQTT-client/credential state, session extension, connection tracking.
 *
 * ★ Runs on the shared SDK test harness. The old file's "logout returns
 * false" test was dropped: it asserted the base-class placeholder that only
 * existed because the Logout method module wasn't imported — the harness
 * registers all methods, and real logout behaviour is covered in
 * ESPRMNeoUser.profile.test.ts.
 */

import { setupSdkTest, DEFAULT_TEST_TOKENS } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoAuth } from "../../src/ESPRMNeoAuth";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { StorageKeys, TokenErrorCodes } from "../../src/utils/constants";
import { isTokenExpired } from "../../src/services/ESPRMNeoHelpers/CheckTokenExpiry";

// CheckTokenExpiry is globally mocked in __tests__/utils/setup.ts, so this is
// already a jest.fn(); jest.mocked() only adds the mock typing.
const mockIsTokenExpired = jest.mocked(isTokenExpired);
const h = setupSdkTest();

describe("ESPRMNeoUser", () => {
  describe("constructor", () => {
    it("should initialize user with tokens and store them", async () => {
      const user = h.user();

      // Tokens live in storage only; the getters read them back.
      await expect(user.getAccessToken()).resolves.toBe(
        DEFAULT_TEST_TOKENS.accessToken
      );
      await expect(user.getIdToken()).resolves.toBe(
        DEFAULT_TEST_TOKENS.idToken
      );
      await expect(user.getRefreshToken()).resolves.toBe(
        DEFAULT_TEST_TOKENS.refreshToken
      );

      expect(h.storage.setItem).toHaveBeenCalledWith(
        StorageKeys.ACCESSTOKEN,
        DEFAULT_TEST_TOKENS.accessToken
      );
      expect(h.storage.setItem).toHaveBeenCalledWith(
        StorageKeys.IDTOKEN,
        DEFAULT_TEST_TOKENS.idToken
      );
      expect(h.storage.setItem).toHaveBeenCalledWith(
        StorageKeys.REFRESHTOKEN,
        DEFAULT_TEST_TOKENS.refreshToken
      );
    });

    it("should handle missing identity ID gracefully", () => {
      jest.spyOn(ESPRMNeoBase, "getConfig").mockReturnValue({
        awsRegion: "us-east-1",
        identityId: undefined,
      } as never);

      expect(() => h.user()).not.toThrow();
    });
  });

  describe("getAccessToken / getIdToken refresh", () => {
    const mockRefreshResponse = {
      accessToken: "new-access-token",
      idToken: "new-id-token",
      refreshToken: "new-refresh-token",
    };

    function mockGetRefreshedTokens() {
      (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens =
        jest.fn().mockResolvedValue(mockRefreshResponse);
    }

    it("returns stored access token when not expired without refreshing", async () => {
      mockGetRefreshedTokens();
      mockIsTokenExpired.mockReturnValue(false);
      const user = h.user();

      await expect(user.getAccessToken()).resolves.toBe(
        DEFAULT_TEST_TOKENS.accessToken
      );
      expect(
        (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens
      ).not.toHaveBeenCalled();
    });

    it("refreshes session when access token is expired", async () => {
      mockGetRefreshedTokens();
      mockIsTokenExpired.mockReturnValue(true);
      const user = h.user();

      await expect(user.getAccessToken()).resolves.toBe(
        mockRefreshResponse.accessToken
      );
      expect(
        (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens
      ).toHaveBeenCalledWith(DEFAULT_TEST_TOKENS.refreshToken);
    });

    it("refreshes session when id token is expired", async () => {
      mockGetRefreshedTokens();
      mockIsTokenExpired.mockReturnValue(true);
      const user = h.user();

      await expect(user.getIdToken()).resolves.toBe(mockRefreshResponse.idToken);
      expect(
        (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens
      ).toHaveBeenCalledWith(DEFAULT_TEST_TOKENS.refreshToken);
    });

    it("dedupes concurrent refresh calls after expiry", async () => {
      let resolveRefresh!: (value: typeof mockRefreshResponse) => void;
      const refreshStarted = new Promise<void>((resolveStarted) => {
        (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens =
          jest.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                resolveRefresh = resolve;
                resolveStarted();
              })
          );
      });
      mockIsTokenExpired.mockReturnValue(true);
      const user = h.user();

      const first = user.getAccessToken();
      const second = user.getAccessToken();
      await refreshStarted;
      resolveRefresh(mockRefreshResponse);

      await expect(Promise.all([first, second])).resolves.toEqual([
        mockRefreshResponse.accessToken,
        mockRefreshResponse.accessToken,
      ]);
      expect(
        (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens
      ).toHaveBeenCalledTimes(1);
    });

    it("throws EXTEND_SESSION_FAILED when refresh API fails", async () => {
      (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens =
        jest.fn().mockRejectedValue(new Error("Refresh failed"));
      mockIsTokenExpired.mockReturnValue(true);
      const user = h.user();

      await expect(user.getAccessToken()).rejects.toMatchObject({
        code: TokenErrorCodes.EXTEND_SESSION_FAILED,
      });
    });
  });

  describe("extendSession", () => {
    it("should extend session with refresh token", async () => {
      const mockRefreshResponse = {
        accessToken: "new-access-token",
        idToken: "new-id-token",
        refreshToken: "new-refresh-token",
      };
      // ESPRMNeoAuth is class-mocked globally (setup.ts) without this static —
      // assign it, as the SDK only calls it as a static function.
      (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens =
        jest.fn().mockResolvedValue(mockRefreshResponse);

      await ESPRMNeoUser.extendSession("refresh-token");

      expect(
        (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens
      ).toHaveBeenCalledWith("refresh-token");
      expect(h.storage.setItem).toHaveBeenCalledWith(
        StorageKeys.ACCESSTOKEN,
        mockRefreshResponse.accessToken
      );
      expect(h.storage.setItem).toHaveBeenCalledWith(
        StorageKeys.IDTOKEN,
        mockRefreshResponse.idToken
      );
      expect(h.storage.setItem).toHaveBeenCalledWith(
        StorageKeys.REFRESHTOKEN,
        mockRefreshResponse.refreshToken
      );
    });

    it("should handle refresh session errors", async () => {
      (ESPRMNeoAuth as unknown as Record<string, jest.Mock>).getRefreshedTokens =
        jest.fn().mockRejectedValue(new Error("Refresh failed"));

      await expect(ESPRMNeoUser.extendSession("refresh-token")).rejects.toThrow(
        "Refresh failed"
      );
    });
  });

});
