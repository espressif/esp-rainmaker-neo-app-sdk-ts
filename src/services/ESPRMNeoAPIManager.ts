/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "../utils/logger";

const logger = new Logger("ESPRMNeoAPIManager");
const JSON_CONTENT_TYPE = "application/json";

// ═════════════════════════════════════════════════════════════════════
// Public init contract
// ═════════════════════════════════════════════════════════════════════

/**
 * Dependencies required to construct the base API manager. Passed explicitly
 * at init time; the class does not reach back into {@link ESPRMNeoBase}.
 */
export interface ESPRMNeoAPIManagerInit {
  /**
   * Fully-resolved User API base URL, e.g.
   * "https://api.rainmaker.espressif.com/prod". Trailing slash is normalised.
   */
  userApiBase: string;
}

// ═════════════════════════════════════════════════════════════════════
// Module-scoped state
// ═════════════════════════════════════════════════════════════════════

/**
 * Module-scoped singleton. Cannot be constructed by external code because the
 * class constructor is protected (only subclasses reach it via `super()`);
 * the only construction path is {@link initializeAPIManager}, which lives in
 * this module and is not re-exported through the public SDK barrel.
 */
let instance: ESPRMNeoAPIManager | null = null;

/**
 * User API base URL, resolved once at init and reused by every request.
 * Read by {@link ESPRMNeoAPIManager} instance methods via
 * {@link requireUserApiBase} to avoid re-computing it per request.
 */
let userApiBase: string | null = null;

function requireUserApiBase(): string {
  if (userApiBase == null) {
    throw new Error(
      "ESPRMNeoAPIManager not initialized. Ensure ESPRMNeoBase.configure() ran first."
    );
  }
  return userApiBase;
}

/**
 * Base API manager: plain HTTP calls with no signing.
 * Use for unauthenticated endpoints (e.g. token/refresh) and endpoints that
 * carry a Cognito bearer token in the `Authorization` header.
 * ESPSigV4APIManager extends this and adds SigV4 for authenticated calls.
 */
export class ESPRMNeoAPIManager {
  // ═════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═════════════════════════════════════════════════════════════════════

  /**
   * `protected` (not `private`) so `ESPSigV4APIManager` can `extends` this
   * class and call `super()`. External construction is blocked by the class
   * itself not being publicly exported from `services/export.ts`.
   */
  protected constructor() {}

  /**
   * Friend-access hook used only by {@link initializeAPIManager} in this
   * module.
   *
   * @internal
   */
  static _construct(): ESPRMNeoAPIManager {
    return new ESPRMNeoAPIManager();
  }

  /**
   * Returns the singleton constructed by SDK bootstrap.
   *
   * @throws {Error} If the SDK has not been configured.
   */
  public static getInstance(): ESPRMNeoAPIManager {
    if (!instance) {
      throw new Error(
        "ESPRMNeoAPIManager not initialized. Ensure ESPRMNeoBase.configure() ran first."
      );
    }
    return instance;
  }

  // ═════════════════════════════════════════════════════════════════════
  // Public User API entry points
  // ═════════════════════════════════════════════════════════════════════

  /**
   * POST to the User API base with no authentication (e.g. token/refresh).
   * Overridden by subclasses that need signing.
   */
  public async postUserApi<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>("POST", path, this.jsonHeaders({}), data);
  }

  /**
   * POST to the User API base with a Cognito Bearer token
   * (`CognitoAuthorizer` / `cognito_user_pools`).
   */
  public async postUserApiWithBearer<T>(
    path: string,
    data: unknown,
    bearerToken: string
  ): Promise<T> {
    return this.request<T>("POST", path, this.jsonHeaders({ bearerToken }), data);
  }

  /**
   * PUT to the User API base with a Cognito Bearer token.
   */
  public async putUserApiWithBearer<T>(
    path: string,
    data: unknown,
    bearerToken: string
  ): Promise<T> {
    return this.request<T>("PUT", path, this.jsonHeaders({ bearerToken }), data);
  }

  /**
   * GET from the User API base with a Cognito Bearer token.
   */
  public async getUserApiWithBearer<T>(
    path: string,
    bearerToken: string
  ): Promise<T> {
    return this.request<T>("GET", path, this.jsonHeaders({ bearerToken }));
  }

  // ═════════════════════════════════════════════════════════════════════
  // Request pipeline
  // ═════════════════════════════════════════════════════════════════════

  /** Orchestrates fetch + parse for User API calls. */
  protected async request<T>(
    method: string,
    path: string,
    headers: Record<string, string>,
    data?: unknown
  ): Promise<T> {
    const url = this.buildApiUrl(path);
    try {
      const response = await this.sendRequest(url, method, headers, data);
      return await this.parseJsonResponse<T>(response, url);
    } catch (err) {
      return this.handleRequestError(err);
    }
  }

  /** DRY: JSON headers with optional Bearer token. */
  private jsonHeaders({ bearerToken }: { bearerToken?: string }): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": JSON_CONTENT_TYPE,
    };
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }
    return headers;
  }

  /** SRP: Builds full User API URL from path. */
  private buildApiUrl(path: string): string {
    const base = requireUserApiBase();
    const pathWithSlash = path.startsWith("/") ? path : `/${path}`;
    return `${base}${pathWithSlash}`;
  }

  /** SRP: Pure fetch only — returns raw Response. */
  private sendRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    data?: unknown
  ): Promise<Response> {
    return fetch(url, {
      method,
      headers,
      body: data != null ? JSON.stringify(data) : undefined,
    });
  }

  /** SRP: Parses Response to JSON and throws on HTTP error. */
  private async parseJsonResponse<T>(
    response: Response,
    url: string
  ): Promise<T> {
    logger.debug("User API response", {
      status: response.status,
      statusText: response.statusText,
    });

    const text = await response.text();
    const responseData = (() => {
      try {
        return text ? JSON.parse(text) : null;
      } catch (parseErr) {
        logger.debug("User API: Failed to parse response as JSON", parseErr);
        throw new Error(
          "Failed to parse response as JSON",
          parseErr instanceof Error ? { cause: parseErr } : undefined
        );
      }
    })() as unknown;

    if (!response.ok) {
      const rd = responseData as Record<string, unknown>;
      const message =
        (rd?.message as string) ||
        (rd?.error as string) ||
        `HTTP error! status: ${response.status}`;
      logger.error("User API request failed:", { url, status: response.status, message });
      const err = new Error(message) as Error & {
        status: number;
        responseData: unknown;
      };
      err.status = response.status;
      err.responseData = responseData;
      throw err;
    }

    return responseData as T;
  }

  /** SRP: Handles network errors (rethrows API errors with status). */
  private handleRequestError(err: unknown): never {
    const e = err as { status?: number; message?: string };
    if (e?.status != null) {
      throw err;
    }
    logger.error("User API request failed:", e?.message ?? err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ═════════════════════════════════════════════════════════════════════
// SDK bootstrap hooks (not re-exported publicly)
// ═════════════════════════════════════════════════════════════════════

/**
 * SDK bootstrap hook. Called by {@link ESPRMNeoBase.configure}. Caches the
 * User API base and constructs the singleton. Not re-exported through the
 * public SDK barrel.
 *
 * @internal
 * @throws {Error} If already initialized.
 */
export function initializeAPIManager(init: ESPRMNeoAPIManagerInit): void {
  if (instance) {
    throw new Error(
      "ESPRMNeoAPIManager already initialized. Re-configuring the SDK is not supported."
    );
  }
  userApiBase = init.userApiBase.replace(/\/$/, "");
  instance = ESPRMNeoAPIManager._construct();
}

/**
 * Test-only hook to reset the singleton and cached base URL between test
 * cases. Not re-exported.
 *
 * @internal
 */
export function _resetAPIManagerForTests(): void {
  instance = null;
  userApiBase = null;
}
