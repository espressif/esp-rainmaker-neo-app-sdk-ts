import { ESPRMNeoAuth } from "../src/ESPRMNeoAuth";
import { ESPRMNeoUser } from "../src/ESPRMNeoUser";
import { configureAuthInstance } from "./utils/configureAuthInstance";

import "../src/methods/ESPRMNeoUser/GetUserInfo";
import "../src/methods/ESPRMNeoUser/GetGroups";

const shouldSkipIntegrationTests =
  !process.env.USERNAME || !process.env.PASSWORD;

describe("ESPRMNeoUser", () => {
  let authInstance: ESPRMNeoAuth;
  let userInstance: ESPRMNeoUser;

  beforeAll(async () => {
    if (shouldSkipIntegrationTests) {
      return;
    }
    authInstance = configureAuthInstance();
    userInstance = await authInstance.login(
      process.env.USERNAME!,
      process.env.PASSWORD!
    );
  });

  describe("getUserInfo", () => {
    it("should fetch user information", async () => {
      if (shouldSkipIntegrationTests) {
        return;
      }
      const userInfo = await userInstance.getUserInfo();
      expect(userInfo).toHaveProperty("username");
      expect(userInfo).toHaveProperty("userAttributes");
    });
  });

  describe("getGroups", () => {
    it("should return user groups as array of ESPRMNeoGroup", async () => {
      if (shouldSkipIntegrationTests) {
        return;
      }
      const groups = await userInstance.getGroups();
      expect(Array.isArray(groups)).toBe(true);
      if (groups.length > 0) {
        expect(groups[0]).toHaveProperty("groupId");
        expect(groups[0]).toHaveProperty("groupName");
      }
    });
  });
});
