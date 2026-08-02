/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * In-memory mock of the signed REST API used by SDK integration/workflow tests.
 *
 * It is intentionally not a real HTTP server: it implements the same surface the
 * SDK calls on `ESPSigV4APIManager` (`request`/`get`/`post`/`put`/`patch`/
 * `delete`) and routes path templates to handlers. Handlers return
 * OpenAPI-generated fixtures, so the data flowing through the SDK stays bound to
 * the contract. State (e.g. a created sharing request) can live in a handler
 * closure to model a multi-step workflow.
 */

import {
  assertValidSchema,
  requestSchemaFor,
} from "../schema-validator";

export class MockHttpError extends Error {
  status: number;
  responseData: unknown;
  constructor(status: number, message: string, responseData: unknown = null) {
    super(message);
    this.name = "MockHttpError";
    this.status = status;
    this.responseData = responseData;
  }
}

export interface RequestContext {
  method: string;
  path: string;
  params: Record<string, string>;
  /** Parsed query string (`?page=2&limit=10` → { page: "2", limit: "10" }). */
  query: Record<string, string>;
  data: unknown;
}

export type RouteHandler = (ctx: RequestContext) => unknown | Promise<unknown>;

interface CompiledRoute {
  method: string;
  pattern: string;
  regex: RegExp;
  keys: string[];
  handler: RouteHandler;
  /** Remaining matches before this route expires (Infinity = persistent). */
  remaining: number;
  delayMs: number;
}

export interface RouteOptions {
  /**
   * Consume the route after this many matches; later registrations for the
   * same method+pattern then take over. Enables fault sequences:
   *
   *   api.failOnce("POST", "/v1/user/credentials", 401)   // first call: 401
   *      .respond("POST", "/v1/user/credentials", body);  // retry: success
   */
  times?: number;
  /** Artificial latency before the handler runs (real ms — keep small). */
  delayMs?: number;
}

export interface FaultOptions extends RouteOptions {
  /** Artificial latency before the fault fires (real ms — keep small). */
  delayMs?: number;
  /**
   * Error message the SDK sees. Defaults to `HTTP error! status: <status>`,
   * matching what ESPSigV4APIManager throws for a non-2xx response.
   */
  message?: string;
  /** Error response body — use `validatedError(...)` for spec-shaped bodies. */
  body?: unknown;
}

export interface MockApiManagerOptions {
  /**
   * Validate incoming request bodies against the spec's request schemas
   *. On by default — an SDK that builds a request the spec
   * forbids should fail the test. Turn off only in failure-mode tests that
   * deliberately send malformed requests.
   */
  validateRequests?: boolean;
}

/** `:id` and `{id}` placeholders normalise identically for duplicate checks. */
function normalizeTemplate(pattern: string): string {
  return pattern
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{}")
    .replace(/\{[^}]*\}/g, "{}");
}

function compile(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = pattern
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        keys.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${source}/?$`), keys };
}

export class MockApiManager {
  private routes: CompiledRoute[] = [];
  private readonly validateRequests: boolean;
  /** Every call routed through the mock, for assertions on request construction. */
  public readonly calls: {
    method: string;
    path: string;
    query: Record<string, string>;
    data: unknown;
  }[] = [];

  constructor(options: MockApiManagerOptions = {}) {
    this.validateRequests = options.validateRequests ?? true;
  }

  on(method: string, pattern: string, handler: RouteHandler, opts: RouteOptions = {}): this {
    const { regex, keys } = compile(pattern);
    const remaining = opts.times ?? Infinity;

    // Duplicate detection: a second PERSISTENT route for the same
    // method+pattern is unreachable dead weight — almost always a test bug.
    // Finite `times:` routes are exempt (that is how sequences are built).
    if (remaining === Infinity) {
      const clash = this.routes.find(
        (r) =>
          r.remaining === Infinity &&
          r.method === method.toUpperCase() &&
          normalizeTemplate(r.pattern) === normalizeTemplate(pattern)
      );
      if (clash) {
        throw new Error(
          `Duplicate persistent route ${method.toUpperCase()} ${pattern} — ` +
            `the earlier registration ("${clash.pattern}") would always win. ` +
            `Use { times: n } for sequences, or reset() first.`
        );
      }
    }

    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      regex,
      keys,
      handler,
      remaining,
      delayMs: opts.delayMs ?? 0,
    });
    return this;
  }

  /** Drop all routes and the call log (rarely needed — prefer a fresh instance). */
  reset(): this {
    this.routes.length = 0;
    this.calls.length = 0;
    return this;
  }

  /** Sugar for a static success payload. */
  respond(method: string, pattern: string, value: unknown, opts: RouteOptions = {}): this {
    return this.on(method, pattern, () => value, opts);
  }

  /**
   * Fault injection: the route rejects like the real API manager does
   * for an HTTP <status> response.
   */
  fail(method: string, pattern: string, status: number, opts: FaultOptions = {}): this {
    const { times, delayMs, message, body } = opts;
    return this.on(
      method,
      pattern,
      () => {
        throw new MockHttpError(
          status,
          message ?? `HTTP error! status: ${status}`,
          body ?? null
        );
      },
      { times, delayMs }
    );
  }

  /** One-shot fault — first match fails, later routes take over. */
  failOnce(method: string, pattern: string, status: number, opts: Omit<FaultOptions, "times"> = {}): this {
    return this.fail(method, pattern, status, { ...opts, times: 1 });
  }

  /** Transport-level failure (DNS, offline, aborted) — a plain Error, no status. */
  networkError(method: string, pattern: string, message = "Network request failed", opts: RouteOptions = {}): this {
    return this.on(
      method,
      pattern,
      () => {
        throw new Error(message);
      },
      opts
    );
  }

  /** Calls whose method+path match, for request-construction assertions. */
  callsTo(
    method: string,
    pattern: string
  ): { method: string; path: string; query: Record<string, string>; data: unknown }[] {
    const { regex } = compile(pattern);
    const m = method.toUpperCase();
    return this.calls.filter((c) => c.method === m && regex.test(c.path));
  }

  async handle<T>(method: string, path: string, data?: unknown): Promise<T> {
    const [pathname, queryString] = path.split("?");
    const query: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(queryString ?? "")) query[k] = v;
    this.calls.push({ method: method.toUpperCase(), path: pathname, query, data });
    for (const route of this.routes) {
      if (route.remaining <= 0) continue; // consumed one-shot route
      if (route.method !== method.toUpperCase()) continue;
      const match = route.regex.exec(pathname);
      if (!match) continue;
      route.remaining--;

      // The SDK's main job is BUILDING requests — check the
      // body it built against the spec's request schema before the handler
      // sees it. Only fires for operations tracked with requestBody: true.
      if (this.validateRequests && data !== undefined) {
        const schema = requestSchemaFor(route.method, route.pattern);
        if (schema) {
          try {
            assertValidSchema(schema, data);
          } catch (err) {
            throw new Error(
              `SDK built an invalid request body for ${route.method} ${pathname}:\n` +
                `${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      }

      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));
      if (route.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, route.delayMs));
      }
      return (await route.handler({ method, path: pathname, query, params, data })) as T;
    }
    throw new MockHttpError(404, `No mock route for ${method} ${pathname}`);
  }

  // ---- Surface mirrored from ESPSigV4APIManager ----
  request = <T>(method: string, path: string, data?: unknown): Promise<T> =>
    this.handle<T>(method, path, data);
  get = <T>(path: string): Promise<T> => this.handle<T>("GET", path);
  post = <T>(path: string, data?: unknown): Promise<T> =>
    this.handle<T>("POST", path, data);
  put = <T>(path: string, data?: unknown): Promise<T> =>
    this.handle<T>("PUT", path, data);
  patch = <T>(path: string, data?: unknown): Promise<T> =>
    this.handle<T>("PATCH", path, data);
  delete = <T>(path: string): Promise<T> => this.handle<T>("DELETE", path);
}
