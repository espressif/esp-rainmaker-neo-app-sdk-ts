/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { ESPRMNeoBaseConfig } from "../../src/types/input";
import * as fs from "fs";
import * as path from "path";
import { getIntegrationTestConfig, getIntegrationTestUser } from "./setup";

// Type definitions for test credentials
interface TestUser {
  username: string;
  password: string;
  description: string;
}

interface TestCredentials {
  testUsers: TestUser[];
}

// Import user methods
import "../../src/methods/ESPRMNeoUser/GetGroups";
import "../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials";
import "../../src/methods/ESPRMNeoUser/GetUserInfo";

// Real backend configuration from environment variables
const realConfig: ESPRMNeoBaseConfig = getIntegrationTestConfig();

// Minimal valid-format JWT (decodeable) so ESPRMNeoUser constructor does not throw; API will reject with 401
const INVALID_BUT_VALID_JWT =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJpbnZhbGlkIn0.x";

describe("ESPRMNeoUser Integration Tests", () => {
  beforeAll(() => {
    // Configure SDK with real backend
    ESPRMNeoBase.init(realConfig);
  });

  describe("ESPRMNeoUser Methods", () => {
    it("should test getGroups() method with real API call", async () => {
      // Use valid-format JWT so constructor does not throw; API call will fail with invalid token
      const userTokens = {
        accessToken: INVALID_BUT_VALID_JWT,
        idToken: INVALID_BUT_VALID_JWT,
        refreshToken: "invalid-refresh-token",
      };

      console.log("ESPRMNeoUser.getGroups() request:", {
        userTokens: {
          accessToken: userTokens.accessToken,
          idToken: userTokens.idToken,
          refreshToken: userTokens.refreshToken,
        },
      });

      const user = new ESPRMNeoUser(userTokens);

      // Test real API call to get groups (should fail with invalid token)
      try {
        const result = await user.getGroups();
        console.log("ESPRMNeoUser.getGroups() response:", result);
        fail("Get groups should have failed with invalid token");
      } catch (error) {
        console.log("ESPRMNeoUser.getGroups() error response:", {
          message: (error as Error).message,
          name: (error as Error).name,
          stack: (error as Error).stack?.split("\n").slice(0, 3).join("\n"),
        });
        expect(error).toBeDefined();
      }
    });

    it("should test getTemporaryAWSCredentials() method with real API call", async () => {
      const user = new ESPRMNeoUser({
        accessToken: INVALID_BUT_VALID_JWT,
        idToken: INVALID_BUT_VALID_JWT,
        refreshToken: "invalid-refresh-token",
      });

      // Test real API call to get AWS credentials (should fail with invalid token)
      try {
        const result = await user.getTemporaryAWSCredentials();
        console.log("Unexpected AWS credentials success:", result);
        fail("Get AWS credentials should have failed with invalid token");
      } catch (error) {
        console.log(
          "ESPRMNeoUser.getTemporaryAWSCredentials() error:",
          (error as Error).message
        );
        expect(error).toBeDefined();
      }
    });

    it("should test user methods with real credentials from env or file", async () => {
      // Collect test users from env (TEST_USERNAME / TEST_PASSWORD) and optional file
      const users: TestUser[] = [];

      const envUser = getIntegrationTestUser();
      if (envUser) {
        users.push({
          username: envUser.username,
          password: envUser.password,
          description: "env TEST_USERNAME/TEST_PASSWORD",
        });
      }

      // Try to load additional test credentials from file
      let testCredentials: TestCredentials | null = null;
      try {
        const credentialsPath = path.join(
          process.cwd(),
          "test-credentials.json"
        );
        if (fs.existsSync(credentialsPath)) {
          const credentialsFile = fs.readFileSync(credentialsPath, "utf8");
          testCredentials = JSON.parse(credentialsFile);
        }
      } catch (error) {
        console.log(
          "Could not load test credentials file:",
          (error as Error).message
        );
      }

      if (
        testCredentials &&
        testCredentials.testUsers &&
        testCredentials.testUsers.length > 0
      ) {
        users.push(...testCredentials.testUsers);
      }

      if (users.length === 0) {
        console.log(
          "Skipping real user operations test - no valid credentials found"
        );
        console.log(
          "To test with real credentials, update test-credentials.json with valid test user credentials"
        );
        return;
      }

      console.log(
        `Testing user operations with ${users.length} test users from env/file`
      );

      // Test each user in the credentials list
      for (let i = 0; i < users.length; i++) {
        const testUser = users[i];

        if (!testUser.username || !testUser.password) {
          console.log(`Skipping user ${i + 1} - missing username or password`);
          continue;
        }

        console.log(`Testing user operations for user ${i + 1}:`, {
          username: testUser.username,
          description: testUser.description,
        });

        // First try to login to get real tokens
        const auth = ESPRMNeoBase.getAuthInstance();
        let user: ESPRMNeoUser | null = null;

        try {
          user = await auth.login(testUser.username, testUser.password);
          console.log(
            `Login successful for user ${i + 1}, testing user operations...`
          );
        } catch (error) {
          console.log(
            `Login failed for user ${i + 1}:`,
            (error as Error).message
          );
          continue; // Skip this user if login fails
        }

        if (user) {
          // Test getGroups with real user
          try {
            const groups = await user.getGroups();
            console.log(`ESPRMNeoUser.getGroups() success for user ${i + 1}:`, {
              groupsCount: groups?.length || 0,
              username: testUser.username,
            });
          } catch (error) {
            console.log(`ESPRMNeoUser.getGroups() error for user ${i + 1}:`, {
              message: (error as Error).message,
              username: testUser.username,
            });
          }

          // Test getTemporaryAWSCredentials with real user
          try {
            const credentialsResult = await user.getTemporaryAWSCredentials();
            console.log(
              `ESPRMNeoUser.getTemporaryAWSCredentials() success for user ${i + 1}:`,
              {
                hasCredentials: !!credentialsResult,
                username: testUser.username,
              }
            );
          } catch (error) {
            console.log(
              `ESPRMNeoUser.getTemporaryAWSCredentials() error for user ${i + 1}:`,
              {
                message: (error as Error).message,
                username: testUser.username,
              }
            );
          }
        }
      }
    });
  });
});
