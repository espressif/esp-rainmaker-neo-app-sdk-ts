import { ESPRMNeoAuth } from "../src/ESPRMNeoAuth";
import { ESPRMNeoUser } from "../src/ESPRMNeoUser";
import { configureAuthInstance } from "./utils/configureAuthInstance";

// Import the method extensions before using them
import "../src/methods/ESPRMNeoAuth/Login";
import "../src/methods/ESPRMNeoAuth/SendSignUpCode";
import "../src/methods/ESPRMNeoAuth/ConfirmSignUp";

// Skip integration tests if credentials are not provided
const shouldSkipIntegrationTests =
  !process.env.USERNAME || !process.env.PASSWORD;

describe("ESPRMNeoAuth", () => {
  let authInstance: ESPRMNeoAuth;

  beforeAll(() => {
    if (shouldSkipIntegrationTests) {
      return;
    }
    authInstance = configureAuthInstance();
  });

  describe("login", () => {
    it("should successfully login with valid credentials", async () => {
      if (shouldSkipIntegrationTests) {
        return;
      }
      const userInstance = await authInstance.login(
        process.env.USERNAME!,
        process.env.PASSWORD!
      );
      expect(userInstance).toBeInstanceOf(ESPRMNeoUser);
    });

    it("should throw error with invalid credentials", async () => {
      if (shouldSkipIntegrationTests) {
        return;
      }
      await expect(
        authInstance.login("invalid@email.com", "wrongpassword")
      ).rejects.toThrow();
    });
  });

  describe("sendSignUpCode", () => {
    it("should send signup code for new user", async () => {
      if (shouldSkipIntegrationTests) {
        return;
      }
      await expect(
        authInstance.sendSignUpCode("newuser@test.com", "Password123!")
      ).resolves.not.toThrow();
    });
  });

  describe("confirmSignUp", () => {
    it("should throw error with invalid verification code", async () => {
      if (shouldSkipIntegrationTests) {
        return;
      }
      await expect(
        authInstance.confirmSignUp("test@email.com", "123456")
      ).rejects.toThrow();
    });
  });
});
