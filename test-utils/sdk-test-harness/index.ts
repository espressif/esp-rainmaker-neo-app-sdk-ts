/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * One-call SDK test setup — THE way to fake the backend.
 *
 * Before this harness the repo had five mocking patterns (Analysis §5.5):
 * typed `mockSigV4` stubs, per-file `jest.mock` factories, the legacy
 * `mockAPIManager` object, raw `global.fetch` mocks, and `MockApiManager`.
 * `setupSdkTest()` replaces the per-file boilerplate with one call:
 *
 *   const h = setupSdkTest();                     // describe/module scope
 *
 *   it("lists groups", async () => {
 *     h.api.respond("GET", "/v1/groups", validated("ListGroupsResponse", {...}));
 *     const groups = await h.user().getGroups();
 *     expect(groups).toHaveLength(1);
 *   });
 *
 * What one call gives you, re-wired before EVERY test (the unit project runs
 * with `resetMocks: true`, so defaults set once would silently vanish):
 *
 *   - `h.api`   — a fresh route-based `MockApiManager` (request bodies
 *                 auto-validated, fault injection built in),
 *                 installed as the `ESPSigV4APIManager` instance.
 *   - `h.storage` — the globally-mocked `ESPRMNeoStorage`, re-primed with
 *                 sane defaults (`getItem → null`, `getNodeGroups → {groups: []}`, …).
 *   - `h.user()` — an `ESPRMNeoUser` with ALL prototype methods registered
 *                 (this module imports `src/methods/export`), so
 *                 "x is not a function" import-forgetting bugs are impossible.
 *   - `h.userApi` — unsigned/Bearer API boundary (`ESPRMNeoAPIManager`).
 *   - ESPRMNeoBase statics (`getConfig`, `getTransportOrder`)
 *     and `jwt.decodeToken` / `isTokenExpired` spied with working defaults —
 *     override per test via the returned handles or plain `jest.spyOn`.
 *
 * Scope: unit/demo Jest projects only (relies on the global mocks installed
 * by `__tests__/utils/setup.ts` and the jsdom module maps).
 */

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { ESPRMNeoAPIManager } from "../../src/services/ESPRMNeoAPIManager";
import { ESPRMNeoStorage } from "../../src/services/ESPRMNeoStorage/ESPRMNeoStorage";
import { ESPSigV4APIManager } from "../../src/services/ESPSigV4APIManager";
import * as jwt from "../../src/services/ESPRMNeoHelpers/DecodeToken";
import * as tokenExpiry from "../../src/services/ESPRMNeoHelpers/CheckTokenExpiry";
import type { ESPRMNeoBaseConfig, UserTokensData } from "../../src/types/input";
import { MockApiManager } from "../mock-server";

// Register every SDK prototype method once — no per-file method imports.
import "../../src/methods/export";

export interface SdkTestHarnessOptions {
  /** Overrides merged into the default base config. */
  config?: Partial<ESPRMNeoBaseConfig>;
  /** Disable the mock server's automatic request-body validation. */
  validateRequests?: boolean;
}

export interface SdkTestHarness {
  /** Fresh per-test MockApiManager, wired as the SigV4 API instance. */
  readonly api: MockApiManager;
  /** The globally-mocked storage, re-primed with defaults each test. */
  readonly storage: jest.Mocked<typeof ESPRMNeoStorage>;
  /**
   * The unsigned/Bearer API boundary (`ESPRMNeoAPIManager`) — auth flows,
   * logout. Plain jest.fn handles (this API is not route-shaped).
   */
  readonly userApi: {
    postUserApi: jest.Mock;
    postUserApiWithBearer: jest.Mock;
    getUserApiWithBearer: jest.Mock;
  };
  /** Construct an ESPRMNeoUser (all methods registered) with default tokens. */
  user(tokens?: UserTokensData): ESPRMNeoUser;
}

export const DEFAULT_TEST_CONFIG: ESPRMNeoBaseConfig = {
  baseUrl: "https://api.test.local",
  userApiBase: "https://api.test.local",
  awsRegion: "us-east-1",
  identityId: "test-identity",
  iotEndpoint: "test-iot.local",
} as ESPRMNeoBaseConfig;

export const DEFAULT_TEST_TOKENS: UserTokensData = {
  accessToken: "header.payload.sig",
  idToken: "header.payload.sig",
  refreshToken: "refresh-token",
};

/**
 * Call once at describe/module scope. Registers a `beforeEach` that rebuilds
 * the whole boundary after Jest's `resetMocks` wipes it.
 */
export function setupSdkTest(options: SdkTestHarnessOptions = {}): SdkTestHarness {
  const state = {
    api: undefined as unknown as MockApiManager,
    userApi: undefined as unknown as SdkTestHarness["userApi"],
  };

  const storage = ESPRMNeoStorage as jest.Mocked<typeof ESPRMNeoStorage>;

  beforeEach(() => {
    state.api = new MockApiManager({
      validateRequests: options.validateRequests ?? true,
    });

    // API boundary — the global setup.ts mock makes getInstance a jest.fn.
    (ESPSigV4APIManager.getInstance as jest.Mock).mockReturnValue(state.api);

    // Unsigned/Bearer boundary — real class, spied per test.
    state.userApi = {
      postUserApi: jest.fn(),
      postUserApiWithBearer: jest.fn(),
      getUserApiWithBearer: jest.fn(),
    };
    jest
      .spyOn(ESPRMNeoAPIManager, "getInstance")
      .mockReturnValue(state.userApi as never);

    // Base statics — spied on the REAL class (restoreMocks puts them back).
    jest
      .spyOn(ESPRMNeoBase, "getConfig")
      .mockReturnValue({ ...DEFAULT_TEST_CONFIG, ...options.config });
    jest.spyOn(ESPRMNeoBase, "getTransportOrder").mockReturnValue(["cloud"]);
    jest.spyOn(ESPRMNeoBase, "getAuthInstance").mockReturnValue({
      getConfig: () => ({ ...DEFAULT_TEST_CONFIG, ...options.config }),
    } as never);

    // Token plumbing — a decodable "session" by default.
    jest
      .spyOn(jwt, "decodeToken")
      .mockReturnValue({ "cognito:username": "test-user-id" } as never);
    jest.spyOn(tokenExpiry, "isTokenExpired").mockReturnValue(false);

    // Storage defaults (the setup.ts factory defaults die to resetMocks).
    const memStore = new Map<string, string>();
    storage.getItem.mockImplementation(
      (key: string) => Promise.resolve(memStore.get(key) ?? null) as never
    );
    storage.setItem.mockImplementation((key: string, value: string) => {
      memStore.set(key, value);
      return Promise.resolve(undefined);
    });
    storage.removeItem.mockImplementation((key: string) => {
      memStore.delete(key);
      return Promise.resolve(undefined);
    });
    storage.getNodeConfig.mockResolvedValue(null as never);
    storage.setNodeConfig.mockResolvedValue(undefined);
    storage.getTemporaryCredentials.mockResolvedValue(null as never);
    storage.saveTemporaryCredentials.mockResolvedValue(undefined);
  });

  return {
    get api() {
      return state.api;
    },
    get userApi() {
      return state.userApi;
    },
    storage,
    user(tokens: UserTokensData = DEFAULT_TEST_TOKENS): ESPRMNeoUser {
      return new ESPRMNeoUser(tokens);
    },
  };
}
