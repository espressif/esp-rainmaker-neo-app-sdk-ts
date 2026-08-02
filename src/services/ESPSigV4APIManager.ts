/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPAWSCredentials } from "../types/input";
import {
  buildCanonicalQueryString,
  generateIotDeviceGatewayMqttSignedUrl,
  generateSigV4AuthHeader,
} from "../utils/awsSigv4Utils";
import { Logger } from "../utils/logger";
import { ESPRMNeoStorage } from "./ESPRMNeoStorage/ESPRMNeoStorage";
import { ESPRMNeoAPIManager } from "./ESPRMNeoAPIManager";

const logger = new Logger("ESPSigV4APIManager");

// ═════════════════════════════════════════════════════════════════════
// Public init contract
// ═════════════════════════════════════════════════════════════════════

/**
 * Dependencies required to construct the signed API manager. Passed explicitly
 * at init time instead of reaching back into {@link ESPRMNeoBase} — that keeps
 * the class testable in isolation and removes the need for a require-cycle
 * workaround.
 */
export interface ESPSigV4APIManagerInit {
  /**
   * Full API base URL including stage if any
   * (e.g. "https://api.rainmaker.espressif.com/prod").
   */
  baseUrl: string;
  /** AWS region (e.g. "us-east-1"). */
  awsRegion: string;
}

// ═════════════════════════════════════════════════════════════════════
// Module-scoped state
// ═════════════════════════════════════════════════════════════════════

/**
 * Module-scoped singleton. Cannot be constructed by external code because the
 * class constructor is private; the only construction path is
 * {@link initializeSigV4APIManager}, which lives in this module and is not
 * re-exported through the public SDK barrel.
 */
let instance: ESPSigV4APIManager | null = null;

/**
 * In-flight refresh promise for concurrent-call coalescing. When multiple
 * signed requests notice expired credentials at the same time, they all share
 * one Cognito round-trip instead of stampeding.
 */
let refreshInFlight: Promise<ESPAWSCredentials> | null = null;

// ═════════════════════════════════════════════════════════════════════
// Module-scoped helpers
// ═════════════════════════════════════════════════════════════════════

/** Late-bound to avoid a circular import through `../methods/ESPRMNeoUser`. */
function fetchTemporaryAWSCredentials(): Promise<ESPAWSCredentials> {
  return require("../methods/ESPRMNeoUser/GetTemporaryAWSCredentials")
    .fetchTemporaryAWSCredentials();
}

/**
 * Fetches fresh temporary AWS credentials and persists them, coalescing
 * concurrent callers onto a single in-flight promise.
 */
async function refreshTemporaryCredentialsOnce(): Promise<ESPAWSCredentials> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const fresh = await fetchTemporaryAWSCredentials();
      await ESPRMNeoStorage.saveTemporaryCredentials(fresh);
      return fresh;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Produces the two UTC timestamps required by every SigV4-signed request:
 *
 * - `timestamp` – ISO 8601 basic (`YYYYMMDDTHHMMSSZ`), used in the
 *   `X-Amz-Date` header and in the string-to-sign.
 * - `dateStamp` – date-only (`YYYYMMDD`), used in the credential scope
 *   (`{dateStamp}/{region}/{service}/aws4_request`).
 *
 * Computed once per request; both values share the same underlying `Date`.
 */
function formatSigV4Timestamps(date: Date): {
  timestamp: string;
  dateStamp: string;
} {
  // toISOString → "2026-07-18T14:30:22.123Z"; SigV4 needs no separators or ms.
  const timestamp = date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  return { timestamp, dateStamp: timestamp.slice(0, 8) };
}

export class ESPSigV4APIManager extends ESPRMNeoAPIManager {
  // ─── Fields ─────────────────────────────────────────────────────────
  #baseUrl: string;
  #awsRegion: string;
  #service: string = "execute-api";

  // ═════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═════════════════════════════════════════════════════════════════════

  private constructor(init: ESPSigV4APIManagerInit) {
    super();
    this.#baseUrl = init.baseUrl.replace(/\/$/, "");
    this.#awsRegion = init.awsRegion;
  }

  /**
   * Friend-access hook used only by {@link initializeSigV4APIManager} in this
   * module. TypeScript allows a same-class static method to reach the private
   * constructor; free functions cannot. Not part of the public API surface.
   *
   * @internal
   */
  static _constructSigV4(init: ESPSigV4APIManagerInit): ESPSigV4APIManager {
    return new ESPSigV4APIManager(init);
  }

  /**
   * Returns the singleton constructed by SDK bootstrap.
   *
   * @throws {Error} If the SDK has not been configured — usually because
   *   `ESPRMNeoBase.configure()` did not run first.
   */
  public static getInstance(): ESPSigV4APIManager {
    if (!instance) {
      throw new Error(
        "ESPSigV4APIManager not initialized. Ensure ESPRMNeoBase.configure() ran first."
      );
    }
    return instance;
  }

  // ═════════════════════════════════════════════════════════════════════
  // Credential + retry helpers
  // ═════════════════════════════════════════════════════════════════════

  private areCredentialsExpired(credentials: ESPAWSCredentials): boolean {
    // If no expiration field or invalid, treat as expired
    if (!credentials.expiration) {
      return true;
    }

    const expirationDate = new Date(credentials.expiration);

    // If invalid date, treat as expired
    if (isNaN(expirationDate.getTime())) {
      return true;
    }

    // Add buffer time (5 minutes) before actual expiration
    const bufferTime = 5 * 60 * 1000;
    const now = Date.now();
    const isExpired = now + bufferTime >= expirationDate.getTime();

    return isExpired;
  }

  /**
   * Runs `fn` and, on a 403, clears stored credentials and retries once.
   * Any 403 is treated as retryable — AWS uses 403 uniformly for expired /
   * invalid credentials, and a single retry is bounded regardless of the
   * response wording. `retriesLeft` is per-call, so concurrent requests
   * never block each other's retry.
   */
  private async withCredentialsRetry<T>(
    fn: () => Promise<T>,
    retriesLeft: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (retriesLeft > 0 && err?.status === 403) {
        await ESPRMNeoStorage.clearTemporaryCredentials();
        return this.withCredentialsRetry(fn, retriesLeft - 1);
      }
      throw err;
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // Signed HTTP core
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Performs a SigV4-signed request to the given URL. Used by {@link request}.
   */
  private async _signedRequest<T>(
    method: string,
    url: URL,
    data?: any,
    headers: { [key: string]: string } = {}
  ): Promise<{ data: T; status: number; responseData: any }> {
    const canonicalURI = url.pathname;

    let credentials: ESPAWSCredentials;
    try {
      credentials = await ESPRMNeoStorage.getTemporaryCredentials();
      if (this.areCredentialsExpired(credentials)) {
        credentials = await refreshTemporaryCredentialsOnce();
      }
    } catch {
      // No stored credentials, or storage read failed — refresh from Cognito.
      credentials = await refreshTemporaryCredentialsOnce();
    }

    const { timestamp, dateStamp } = formatSigV4Timestamps(new Date());

    const payload = data ? JSON.stringify(data) : "";
    const payloadHash = (crypto as any)
      .createHash("sha256")
      .update(payload)
      .digest("hex");

    const requestHeaders = {
      host: url.host,
      "x-amz-date": timestamp,
      "x-amz-security-token": credentials.sessionToken,
      ...headers,
    };

    const signedHeaderKeys = Object.keys(requestHeaders).sort();
    const signedHeaders = signedHeaderKeys.join(";");
    // SigV4 requires the canonical query string sorted and re-encoded; signing
    // url.search verbatim breaks any request whose params aren't already
    // in sorted order (API Gateway sorts before verifying).
    const canonicalQueryString = buildCanonicalQueryString(url.searchParams);

    const authHeader = generateSigV4AuthHeader({
      accessKey: credentials.accessKey,
      secretKey: credentials.secretKey,
      timestamp,
      dateStamp,
      region: this.#awsRegion,
      service: this.#service,
      method,
      canonicalURI,
      canonicalQueryString,
      requestHeaders,
      signedHeaders,
      payloadHash,
    });

    const response = await fetch(url.toString(), {
      method,
      headers: {
        ...requestHeaders,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const text = await response.text();
    const responseData = (() => {
      try {
        return text ? JSON.parse(text) : null;
      } catch (parseErr) {
        logger.debug("SigV4 API: Failed to parse response as JSON", parseErr);
        throw new Error(
          "Failed to parse response as JSON",
          parseErr instanceof Error ? { cause: parseErr } : undefined
        );
      }
    })() as Record<string, unknown> | null;

    if (!response.ok) {
      logger.error("HTTP request failed:", {
        method,
        url: url.toString(),
        status: response.status,
        message: responseData?.message,
      });
      const errorMessage =
        `HTTP error! status: ${response.status}` +
        (responseData?.message ? ` - ${responseData.message}` : "") +
        (responseData?.error ? ` - ${responseData.error}` : "");
      const err = new Error(errorMessage) as Error & {
        status: number;
        responseData: any;
      };
      err.status = response.status;
      err.responseData = responseData;
      throw err;
    }

    return { data: responseData as T, status: response.status, responseData };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Public HTTP API
  // ═════════════════════════════════════════════════════════════════════

  public async request<T>(
    method: string,
    path: string,
    data?: any,
    headers: { [key: string]: string } = {}
  ): Promise<T> {
    const pathWithSlash = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(this.#baseUrl + pathWithSlash);

    return this.withCredentialsRetry(async () => {
      const result = await this._signedRequest<T>(method, url, data, headers);
      return result.data;
    });
  }

  public async get<T>(
    path: string,
    headers: { [key: string]: string } = {}
  ): Promise<T> {
    return this.request("GET", path, undefined, headers);
  }

  public async post<T>(
    path: string,
    data: any,
    headers: { [key: string]: string } = {}
  ): Promise<T> {
    return this.request("POST", path, data, headers);
  }

  public async put<T>(
    path: string,
    data: any,
    headers: { [key: string]: string } = {}
  ): Promise<T> {
    return this.request("PUT", path, data, headers);
  }

  public async patch<T>(
    path: string,
    data: any,
    headers: { [key: string]: string } = {}
  ): Promise<T> {
    return this.request("PATCH", path, data, headers);
  }

  public async delete<T>(
    path: string,
    headers: { [key: string]: string } = {}
  ): Promise<T> {
    return this.request("DELETE", path, undefined, headers);
  }

  // ═════════════════════════════════════════════════════════════════════
  // IoT MQTT URL signing (static utility)
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Normalizes a config IoT endpoint to a hostname (strips protocol and path).
   */
  static #normalizeIotEndpointHost(endpoint: string): string {
    const trimmed = endpoint.trim();
    const withoutProto = trimmed
      .replace(/^https?:\/\//, "")
      .replace(/^wss?:\/\//, "");
    const hostOnly = withoutProto.split("/")[0];
    if (!hostOnly) {
      throw new Error("Invalid IoT endpoint: empty host");
    }
    return hostOnly;
  }

  /**
   * Presigned `wss://…/mqtt?…` URL for AWS IoT Core MQTT over WebSocket (SigV4 query signing,
   * service `iotdevicegateway`). Uses the same signing primitives as {@link ESPSigV4APIManager._signedRequest}.
   *
   * @param credentials - Temporary AWS credentials (e.g. from `ESPRMNeoUser.getTemporaryAWSCredentials`).
   * @param iotEndpointOrHost - Raw `config.iotEndpoint`, a full `wss://…/mqtt` URL, or hostname only.
   * @param awsRegion - AWS region for signing (e.g. "us-east-1"). Required; passed explicitly so
   *   this helper stays pure and doesn't reach back to global SDK config.
   * @param options - Optional URL expiry (default 86400s).
   */
  public static getIotMqttWebSocketSignedUrl(
    credentials: {
      accessKey: string;
      secretKey: string;
      sessionToken?: string;
    },
    iotEndpointOrHost: string,
    awsRegion: string,
    options?: { expiresSeconds?: number }
  ): string {
    const host = ESPSigV4APIManager.#normalizeIotEndpointHost(iotEndpointOrHost);
    return generateIotDeviceGatewayMqttSignedUrl({
      accessKey: credentials.accessKey,
      secretKey: credentials.secretKey,
      sessionToken: credentials.sessionToken,
      host,
      awsRegion,
      expiresSeconds: options?.expiresSeconds,
    });
  }
}

// ═════════════════════════════════════════════════════════════════════
// SDK bootstrap hooks (not re-exported publicly)
// ═════════════════════════════════════════════════════════════════════

/**
 * SDK bootstrap hook. Called by {@link ESPRMNeoBase.configure}. Not re-exported
 * through the public SDK barrel — external consumers cannot reach this function
 * and cannot construct an {@link ESPSigV4APIManager} instance.
 *
 * @internal
 * @throws {Error} If already initialized.
 */
export function initializeSigV4APIManager(
  init: ESPSigV4APIManagerInit
): void {
  if (instance) {
    throw new Error(
      "ESPSigV4APIManager already initialized. Re-configuring the SDK is not supported."
    );
  }
  instance = ESPSigV4APIManager._constructSigV4(init);
}

/**
 * Test-only hook to reset the singleton and any in-flight refresh promise
 * between test cases. Not re-exported.
 *
 * @internal
 */
export function _resetSigV4APIManagerForTests(): void {
  instance = null;
  refreshInFlight = null;
}
