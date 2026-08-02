/// <reference types="jest" />

/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Integration test setup - uses real backend connections

declare global {
  // eslint-disable-next-line no-var
  var integrationTestUtils: {
    wait: (ms: number) => Promise<void>;
    cleanup: () => Promise<void>;
  };
}
// Note: Not importing react-native modules to avoid Jest issues

import type { ESPRMNeoBaseConfig } from "../../src/types/input";

// Load environment variables from .env.test if it exists
try {
  const { config } = require("dotenv");
  const { resolve } = require("path");
  config({ path: resolve(__dirname, "../../.env.test") });
} catch (error) {
  // dotenv not installed or .env.test file doesn't exist
  console.warn(
    "⚠️  .env.test file not found. Integration tests may fail without proper configuration."
  );
  console.warn(
    "   Copy .env.test.example to .env.test and fill in your test environment values."
  );
}

// Add fetch polyfill for real API calls
import "whatwg-fetch";

// Set longer timeout for integration tests (45s for slow networks)
jest.setTimeout(45000);

// Retry flaky tests once (2 attempts total) to reduce network/timing failures
jest.retryTimes(1);

// Resolve first defined from CDK-style names or RMNEO_*
function env(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function envRequired(...keys: string[]): string {
  const v = env(...keys);
  if (!v) {
    throw new Error(
      `Missing required env: one of ${keys.join(", ")}. See .env.test.example.`
    );
  }
  return v;
}

/** Get SDK config from env. Accepts CDK-style (ApiGatewayUrl, UserPoolId, ...) or RMNEO_* names. */
export function getIntegrationTestConfig(): ESPRMNeoBaseConfig {
  let baseUrl = envRequired("ApiGatewayUrl", "RMNEO_BASE_URL").replace(/\/$/, "");
  // Legacy env: stage path was separate; fold into baseUrl when present.
  const apiPath = env("TEST_API_PATH", "RMNEO_API_PATH");
  if (apiPath) {
    baseUrl = `${baseUrl}/${apiPath.replace(/^\//, "").replace(/\/$/, "")}`;
  }

  let userApiBase =
    env("TEST_USER_API_BASE", "RMNEO_USER_API_BASE")?.replace(/\/$/, "") || "";
  if (!userApiBase) {
    // Legacy split User API env vars → single userApiBase.
    const userApiBaseUrl = env(
      "TEST_USER_API_BASE_URL",
      "EspUserApiUrl",
      "RMNEO_USER_API_BASE_URL"
    );
    if (userApiBaseUrl) {
      const userApiPath = env("TEST_USER_API_PATH", "RMNEO_USER_API_PATH") || "";
      const host = userApiBaseUrl.replace(/\/$/, "");
      const path = userApiPath.replace(/^\//, "").replace(/\/$/, "");
      userApiBase = path ? `${host}/${path}` : host;
    }
  }
  if (!userApiBase) {
    throw new Error(
      "Missing required env for User API base: one of TEST_USER_API_BASE, RMNEO_USER_API_BASE, TEST_USER_API_BASE_URL, EspUserApiUrl, RMNEO_USER_API_BASE_URL"
    );
  }

  return {
    baseUrl,
    userApiBase,
    awsRegion: envRequired("StackRegion", "RMNEO_AWS_REGION"),
    iotEndpoint: envRequired("IoTEndpointUrl", "RMNEO_IOT_ENDPOINT"),
  };
}

/** Test user credentials (optional). From TEST_USERNAME/TEST_PASSWORD or RMNEO_TEST_USERNAME/RMNEO_TEST_PASSWORD. */
export function getIntegrationTestUser(): { username: string; password: string } | null {
  const username = env("TEST_USERNAME", "RMNEO_TEST_USERNAME");
  const password = env("TEST_PASSWORD", "RMNEO_TEST_PASSWORD");
  if (!username || !password) return null;
  return { username, password };
}

// Simple test utilities for integration tests
global.integrationTestUtils = {
  // Wait for async operations to complete
  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Clean up test data
  cleanup: async () => {
    console.log("🧹 Cleaning up test data...");
  },
};

// Setup and teardown for integration tests
beforeAll(async () => {
  // Integration tests starting
});

afterAll(async () => {
  await global.integrationTestUtils.cleanup();
});

// Handle unhandled promise rejections in tests
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Handle uncaught exceptions in tests
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
