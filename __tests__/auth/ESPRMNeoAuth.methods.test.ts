/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for ESPRMNeoAuth prototype methods.
 *
 * ★ Runs on the shared SDK test harness. Auth REST flows mock
 * `h.userApi.postUserApi[WithBearer]` directly. ESPRMNeoUser is no longer
 * class-mocked, so token mapping is asserted against the real instance.
 */

// Unmock ESPRMNeoAuth so prototype methods are tested for real (it is
// class-mocked globally in setup.ts).
jest.unmock("../../src/ESPRMNeoAuth");

import { ESPAuthError, ESPRMNeoAuth } from "../../src/ESPRMNeoAuth";
import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { validated, validatedError } from "../../test-utils/response-builder";
import { expectValidRequest } from "../../test-utils/schema-validator";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";

const h = setupSdkTest({
  config: {
    clientId: "test-client-id",
    userPoolId: "test-user-pool-id",
    userApiBase: "https://test-api.example.com/prod",
  } as never,
});

// ---------------------------------------------------------------------------
// Test data — developer-written, schema-validated at module load
// ---------------------------------------------------------------------------

const SIGNIN_DATA = validated("SigninResponse", {
  access_token:  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.sig",
  id_token:      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.idSig",
  refresh_token: "test-refresh-token-abc",
  token_type:    "Bearer",
  expires_in:    3600,
});

const SIGNUP_DATA = validated("SignupResponse", {
  user_id:              "user-test-123",
  requires_verification: true,
  message:              "Verification email sent",
});

const VERIFY_SIGNUP_DATA = validated("VerifySignupResponse", {
  message: "Account verified successfully",
});

// The backend returns ONLY `message` — verified against the
// rmng source — and the SDK's phantom codeDeliveryDestination/deliveryMedium
// fields were removed accordingly. Spec-pinned fixture.
const FORGOT_PASSWORD_DATA = validated("ForgotPasswordResponse", {
  message: "Password reset code sent to your email/phone",
});

const CONFIRM_RESET_DATA = validated("ChangePasswordResponse", {
  message: "Password reset successfully",
});

const CHANGE_PASSWORD_DATA = validated("ChangePasswordResponse", {
  message: "Password changed successfully",
});

/** Reject like the real unsigned API manager does for an HTTP error body. */
function userApiError(status: number, message: string): Error {
  return Object.assign(new Error(message), {
    status,
    responseData: validatedError("UserApiError", { message }),
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("ESPRMNeoAuth Methods", () => {
  let authInstance: ESPRMNeoAuth;

  beforeEach(() => {
    authInstance = new ESPRMNeoAuth({
      clientId: "test-client-id",
      userPoolId: "test-user-pool-id",
      awsRegion: "us-east-1",
    } as never);
  });

  // =========================================================================
  // login
  // =========================================================================
  describe("login", () => {
    it("successfully logs in and returns an ESPRMNeoUser with the mapped tokens", async () => {
      h.userApi.postUserApi.mockResolvedValue(SIGNIN_DATA);

      const result = await authInstance.login("test@example.com", "password123");

      expect(h.userApi.postUserApi).toHaveBeenCalledWith(
        expect.stringContaining("/v1/user/auth/token"),
        { username: "test@example.com", password: "password123" }
      );
      expectValidRequest("POST /v1/user/auth/token", {
        username: "test@example.com",
        password: "password123",
      });
      expect(result).toBeInstanceOf(ESPRMNeoUser);
      await expect(result.getAccessToken()).resolves.toBe(
        SIGNIN_DATA.access_token
      );
    });

    it("wraps API errors in ESPAuthError", async () => {
      h.userApi.postUserApi.mockRejectedValueOnce(
        userApiError(401, "Invalid username or password")
      );

      await expect(
        authInstance.login("invalid@example.com", "wrongpassword")
      ).rejects.toThrow(ESPAuthError);
    });

    it("throws when the API returns an empty token response", async () => {
      h.userApi.postUserApi.mockResolvedValueOnce(validatedError("UserApiError", {}));

      await expect(
        authInstance.login("test@example.com", "password123")
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // sendSignUpCode
  // =========================================================================
  describe("sendSignUpCode", () => {
    it("calls the signup endpoint and returns the response", async () => {
      h.userApi.postUserApi.mockResolvedValue(SIGNUP_DATA);

      const result = await authInstance.sendSignUpCode(
        "test@example.com", "password123", { given_name: "Test" }
      );

      expect(h.userApi.postUserApi).toHaveBeenCalledWith(
        expect.stringContaining("/v1/user/auth/signup"),
        expect.objectContaining({ email: "test@example.com" })
      );
      expect(result).toMatchObject({});
    });

    it("throws when the API returns an error", async () => {
      h.userApi.postUserApi.mockRejectedValueOnce(
        userApiError(400, "User already exists")
      );

      await expect(
        authInstance.sendSignUpCode("existing@example.com", "password123")
      ).rejects.toThrow("User already exists");
    });
  });

  // =========================================================================
  // confirmSignUp
  // =========================================================================
  describe("confirmSignUp", () => {
    it("calls the verify endpoint and returns a message", async () => {
      h.userApi.postUserApi.mockResolvedValue(VERIFY_SIGNUP_DATA);

      const result = await authInstance.confirmSignUp("test@example.com", "123456");

      expect(h.userApi.postUserApi).toHaveBeenCalledWith(
        expect.stringContaining("/v1/user/auth/signup/verify"),
        expect.objectContaining({ code: "123456" })
      );
      expect(result).toMatchObject({ message: expect.any(String) });
    });

    it("sends { code, email } in the request body", async () => {
      h.userApi.postUserApi.mockResolvedValue(VERIFY_SIGNUP_DATA);

      await authInstance.confirmSignUp("test@example.com", "123456");

      const [, body] = h.userApi.postUserApi.mock.calls[0];
      expect(body).toMatchObject({ code: "123456", email: "test@example.com" });
    });

    it("throws on an invalid confirmation code", async () => {
      h.userApi.postUserApi.mockRejectedValueOnce(
        userApiError(400, "Invalid confirmation code")
      );

      await expect(
        authInstance.confirmSignUp("test@example.com", "000000")
      ).rejects.toThrow("Invalid confirmation code");
    });
  });

  // =========================================================================
  // forgotPassword
  // =========================================================================
  describe("forgotPassword", () => {
    it("calls the password-recovery endpoint", async () => {
      h.userApi.postUserApi.mockResolvedValue(FORGOT_PASSWORD_DATA);

      const result = await authInstance.forgotPassword("test@example.com");

      expect(h.userApi.postUserApi).toHaveBeenCalledWith(
        expect.stringContaining("/v1/user/auth/password-recovery"),
        { username: "test@example.com" }
      );
      expectValidRequest("POST /v1/user/auth/password-recovery", {
        username: "test@example.com",
      });
      // `message` is the only field the backend returns (and now the
      // only field the SDK response type declares).
      expect(result).toEqual({
        message: "Password reset code sent to your email/phone",
      });
    });

    it("throws when the user is not found", async () => {
      h.userApi.postUserApi.mockRejectedValueOnce(userApiError(400, "User not found"));

      await expect(
        authInstance.forgotPassword("nonexistent@example.com")
      ).rejects.toThrow("User not found");
    });
  });

  // =========================================================================
  // setNewPassword
  // =========================================================================
  describe("setNewPassword", () => {
    it("calls the password-recovery/confirmation endpoint", async () => {
      h.userApi.postUserApi.mockResolvedValue(CONFIRM_RESET_DATA);

      const result = await authInstance.setNewPassword(
        "test@example.com", "newpassword123", "confirmation-code"
      );

      expect(h.userApi.postUserApi).toHaveBeenCalledWith(
        expect.stringContaining("/v1/user/auth/password-recovery/confirmation"),
        {
          username: "test@example.com",
          code: "confirmation-code",
          new_password: "newpassword123",
        }
      );
      expectValidRequest("POST /v1/user/auth/password-recovery/confirmation", {
        username: "test@example.com",
        code: "confirmation-code",
        new_password: "newpassword123",
      });
      // Assert against the constant — if the spec changes the message shape, validated()
      // above catches it before this assertion is ever reached.
      expect(result).toEqual({ message: CONFIRM_RESET_DATA.message });
    });

    it("throws on an invalid confirmation code", async () => {
      h.userApi.postUserApi.mockRejectedValueOnce(
        userApiError(400, "Invalid confirmation code")
      );

      await expect(
        authInstance.setNewPassword("test@example.com", "newpassword123", "bad-code")
      ).rejects.toThrow("Invalid confirmation code");
    });
  });

  // =========================================================================
  // changePassword
  // =========================================================================
  describe("changePassword", () => {
    it("calls the bearer endpoint and returns the message", async () => {
      h.storage.getItem.mockResolvedValueOnce("mock-access-token");
      h.userApi.postUserApiWithBearer.mockResolvedValue(CHANGE_PASSWORD_DATA);

      const result = await authInstance.changePassword("oldpassword123", "newpassword123");

      expect(h.userApi.postUserApiWithBearer).toHaveBeenCalledWith(
        "/v1/user/auth/password",
        {
          access_token: "mock-access-token",
          old_password:  "oldpassword123",
          new_password:  "newpassword123",
        },
        "mock-access-token"
      );
      expectValidRequest("POST /v1/user/auth/password", {
        access_token: "mock-access-token",
        old_password: "oldpassword123",
        new_password: "newpassword123",
      });
      expect(result).toEqual({ message: CHANGE_PASSWORD_DATA.message });
    });

    it("throws 'Not logged in' when the access token is absent from storage", async () => {
      h.storage.getItem.mockResolvedValue(null as never);

      await expect(
        authInstance.changePassword("oldpassword123", "newpassword123")
      ).rejects.toThrow("Not logged in");
    });

    it("propagates errors from the bearer API manager", async () => {
      h.storage.getItem.mockResolvedValueOnce("mock-access-token");
      h.userApi.postUserApiWithBearer.mockRejectedValueOnce(
        new Error("Incorrect old password")
      );

      await expect(
        authInstance.changePassword("wrongpassword", "newpassword123")
      ).rejects.toThrow("Incorrect old password");
    });
  });

  // =========================================================================
  // getLoggedInUser
  // =========================================================================
  describe("getLoggedInUser", () => {
    it("returns an ESPRMNeoUser when valid tokens are in storage", async () => {
      h.storage.getItem
        .mockResolvedValueOnce("valid-access-token" as never)
        .mockResolvedValueOnce("valid-id-token" as never)
        .mockResolvedValueOnce("valid-refresh-token" as never);

      const result = await authInstance.getLoggedInUser();

      expect(result).toBeInstanceOf(ESPRMNeoUser);
    });

    it("returns null when no tokens are in storage", async () => {
      h.storage.getItem.mockResolvedValue(null as never);

      const result = await authInstance.getLoggedInUser();

      expect(result).toBeNull();
    });
  });
});
