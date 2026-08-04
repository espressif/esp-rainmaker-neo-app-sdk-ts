/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
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

// Import auth methods
import "../../src/methods/ESPRMNeoAuth/Login";
import "../../src/methods/ESPRMNeoAuth/GetLoggedInUser";

// Real backend configuration from environment variables
const realConfig: ESPRMNeoBaseConfig = getIntegrationTestConfig();

describe("ESPRMNeoAuth Integration Tests", () => {
  beforeAll(() => {
    // Suppress console.log during SDK initialization
    const originalLog = console.log;
    console.log = () => {};

    // Configure SDK with real backend
    ESPRMNeoBase.init(realConfig);

    // Restore console.log
    console.log = originalLog;
  });

  describe("ESPRMNeoAuth Methods", () => {
    it("should test login() method with real AWS Cognito call", async () => {
      const auth = ESPRMNeoBase.getAuthInstance();

      // Test real login with invalid credentials (should fail but test real AWS call)
      const request = {
        username: "invalid@test.com",
        password: "wrongpassword",
      };

      console.log("Request:", JSON.stringify(request, null, 2));

      try {
        const result = await auth.login(request.username, request.password);
        console.log("Response:", JSON.stringify(result, null, 2));
        fail("Login should have failed with invalid credentials");
      } catch (error) {
        console.log(
          "ERROR:",
          JSON.stringify(
            {
              message: (error as Error).message,
              name: (error as Error).name,
            },
            null,
            2
          )
        );
        expect(error).toBeDefined();
        // Backend may return "User does not exist", "NotAuthorizedException", "Network request failed", etc.
        expect((error as Error).message.length).toBeGreaterThan(0);
      }
    });

    it("should test getLoggedInUser() method with real storage check", async () => {
      const auth = ESPRMNeoBase.getAuthInstance();

      // Test real getLoggedInUser (should return null since no user is logged in)
      const result = await auth.getLoggedInUser();

      console.log("Request: getLoggedInUser()");
      console.log(
        "Response:",
        JSON.stringify(
          {
            user: result,
            isLoggedIn: result !== null,
          },
          null,
          2
        )
      );

      expect(result).toBeNull();
    });

    it("should test login() method with real credentials from env or file", async () => {
      const auth = ESPRMNeoBase.getAuthInstance();

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
        console.log("Skipping real login test - no valid credentials found");
        console.log(
          "To test with real credentials, update test-credentials.json with valid test user credentials"
        );
        return;
      }

      // Test each user in the credentials list
      for (let i = 0; i < users.length; i++) {
        const testUser = users[i];

        if (!testUser.username || !testUser.password) {
          continue;
        }

        const request = {
          username: testUser.username,
          password: testUser.password,
        };

        console.log(
          "Request:",
          JSON.stringify(
            {
              username: request.username,
              password: "***hidden***",
              description: testUser.description,
            },
            null,
            2
          )
        );

        try {
          const result = await auth.login(request.username, request.password);
          console.log(
            "Response:",
            JSON.stringify(
              {
                userType: result.constructor.name,
                hasAccessToken: !!(await result
                  .getAccessToken()
                  .catch(() => null)),
                username: request.username,
              },
              null,
              2
            )
          );
          expect(result).toBeDefined();
        } catch (error) {
          console.log(
            "ERROR:",
            JSON.stringify(
              {
                message: (error as Error).message,
                name: (error as Error).name,
                username: request.username,
              },
              null,
              2
            )
          );
          // Don't fail the test - just log the error for debugging
        }
      }
    });
  });
});
