/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for additional ESPRMNeoUser instance methods:
 *   logout, getUserInfo
 *
 * ★ Runs on the shared SDK test harness:
 *   - Bearer/unsigned REST (logout, getUserInfo) → `h.userApi` jest.fn handles
 *   - Token reads/clears (logout)                → `h.storage`
 */

import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import type { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { StorageKeys } from "../../src/utils/constants";

const h = setupSdkTest();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_TOKENS = {
  accessToken: "header.payload.sig",
  idToken:     "id-token-value",
  refreshToken: "refresh-token-value",
};

function makeUser(): ESPRMNeoUser {
  return h.user(FAKE_TOKENS);
}

// ===========================================================================
// logout()
// ===========================================================================
describe("ESPRMNeoUser.logout", () => {
  it("happy path: calls signout endpoint, clears tokens, returns true", async () => {
    h.storage.getItem
      .mockResolvedValueOnce("access-token-value")  // accessToken
      .mockResolvedValueOnce("refresh-token");      // refreshToken
    h.userApi.postUserApiWithBearer.mockResolvedValue({ message: "Signed out" });

    const result = await makeUser().logout();

    expect(result).toBe(true);
    expect(h.userApi.postUserApiWithBearer).toHaveBeenCalledWith(
      expect.stringContaining("signout"),
      expect.objectContaining({ refresh_token: expect.any(String) }),
      "access-token-value"
    );
    expect(h.storage.removeItem).toHaveBeenCalledTimes(3); // access, id, refresh tokens
  });

  it("skips signout API call when no access token is in storage", async () => {
    h.storage.getItem.mockResolvedValue(null as never);

    const result = await makeUser().logout();

    expect(result).toBe(true);
    expect(h.userApi.postUserApiWithBearer).not.toHaveBeenCalled();
  });

  it("still returns true when the signout API call fails (best-effort)", async () => {
    h.storage.getItem.mockResolvedValueOnce("access-token-value");
    h.userApi.postUserApiWithBearer.mockRejectedValue(new Error("Network error"));

    const result = await makeUser().logout();

    expect(result).toBe(true);
  });

});

// ===========================================================================
// getUserInfo() — GET /v1/users/me
// ===========================================================================
describe("ESPRMNeoUser.getUserInfo", () => {
  const PROFILE = {
    user_id: "user-sub-id",
    email: "user@example.com",
  };

  beforeEach(() => {
    h.userApi.getUserApiWithBearer.mockResolvedValue(PROFILE);
  });

  it("happy path: fetches profile and maps username/attributes", async () => {
    const info = await makeUser().getUserInfo();

    expect(h.userApi.getUserApiWithBearer).toHaveBeenCalledWith(
      "/v1/users/me",
      FAKE_TOKENS.accessToken
    );
    expect(info.username).toBe("user@example.com");
    expect(info.userId).toBe("user-sub-id");
    expect(info.userAttributes.email).toBe("user@example.com");
    expect(info.userAttributes.user_id).toBe("user-sub-id");
  });

  it("falls back to phone_number as username when no email", async () => {
    h.userApi.getUserApiWithBearer.mockResolvedValue({
      user_id: "user-sub-id",
      phone_number: "+1234567890",
    });

    const info = await makeUser().getUserInfo();

    expect(info.username).toBe("+1234567890");
  });

  it("falls back to user_id when neither email nor phone present", async () => {
    h.userApi.getUserApiWithBearer.mockResolvedValue({
      user_id: "user-sub-id",
    });

    const info = await makeUser().getUserInfo();

    expect(info.username).toBe("user-sub-id");
  });

  it("always requests /v1/users/me", async () => {
    h.userApi.getUserApiWithBearer.mockResolvedValue({
      user_id: "resolved-from-me",
    });

    const info = await makeUser().getUserInfo();

    expect(h.userApi.getUserApiWithBearer).toHaveBeenCalledWith(
      "/v1/users/me",
      FAKE_TOKENS.accessToken
    );
    expect(info.userId).toBe("resolved-from-me");
  });

  it("uses refreshed tokens from storage over stale in-memory tokens", async () => {
    const REFRESHED_ACCESS = "refreshed.access.token";
    h.storage.getItem.mockImplementation(async (key: string) => {
      if (key === StorageKeys.ACCESSTOKEN) return REFRESHED_ACCESS;
      if (key === StorageKeys.IDTOKEN) return "refreshed-id-token";
      if (key === StorageKeys.REFRESHTOKEN) return FAKE_TOKENS.refreshToken;
      return null;
    });

    const user = makeUser();
    await user.getUserInfo();

    expect(h.userApi.getUserApiWithBearer).toHaveBeenCalledWith(
      "/v1/users/me",
      REFRESHED_ACCESS
    );
    await expect(user.getAccessToken()).resolves.toBe(REFRESHED_ACCESS);
    await expect(user.getIdToken()).resolves.toBe("refreshed-id-token");
  });

  it("failure mode: User API error propagates to the caller", async () => {
    h.userApi.getUserApiWithBearer.mockRejectedValue(new Error("404 Not Found"));

    await expect(makeUser().getUserInfo()).rejects.toThrow("404 Not Found");
  });
});
