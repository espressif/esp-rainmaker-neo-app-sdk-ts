/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Self-tests for the MockApiManager fault-injection surface — the
 * harness that every migrated suite will lean on must prove its own
 * semantics: error fidelity, one-shot route consumption, network faults,
 * and call filtering.
 */

import { validatedError } from "../../test-utils/response-builder";
import { MockApiManager, MockHttpError } from "../../test-utils/mock-server";

const P = "/v1/groups/:groupId/users";

describe("MockApiManager fault injection", () => {
  it("fail(): rejects with the same message shape the real API manager throws", async () => {
    const api = new MockApiManager().fail("GET", P, 403);

    await expect(api.get("/v1/groups/g1/users")).rejects.toThrow(
      "HTTP error! status: 403"
    );
  });

  it("fail(): carries status and a spec-validated error body", async () => {
    const body = validatedError("ApiError", { message: "Forbidden" });
    const api = new MockApiManager().fail("GET", P, 403, { body });

    try {
      await api.get("/v1/groups/g1/users");
      throw new Error("should have rejected");
    } catch (err) {
      expect(err).toBeInstanceOf(MockHttpError);
      expect((err as MockHttpError).status).toBe(403);
      expect((err as MockHttpError).responseData).toEqual({ message: "Forbidden" });
    }
  });

  it("failOnce() + respond(): 401-then-success sequences (auth-refresh shape)", async () => {
    const api = new MockApiManager()
      .failOnce("GET", P, 401)
      .respond("GET", P, { users: [] });

    await expect(api.get("/v1/groups/g1/users")).rejects.toThrow(
      "HTTP error! status: 401"
    );
    await expect(api.get("/v1/groups/g1/users")).resolves.toEqual({ users: [] });
    // and the success route persists
    await expect(api.get("/v1/groups/g1/users")).resolves.toEqual({ users: [] });
  });

  it("times: N consumes a route after N matches", async () => {
    const api = new MockApiManager()
      .fail("GET", P, 500, { times: 2 })
      .respond("GET", P, { users: ["u"] });

    await expect(api.get("/v1/groups/g1/users")).rejects.toThrow("500");
    await expect(api.get("/v1/groups/g1/users")).rejects.toThrow("500");
    await expect(api.get("/v1/groups/g1/users")).resolves.toEqual({ users: ["u"] });
  });

  it("networkError(): plain Error without an HTTP status", async () => {
    const api = new MockApiManager().networkError("GET", P, "Network request failed");

    await expect(api.get("/v1/groups/g1/users")).rejects.toThrow(
      "Network request failed"
    );
    await expect(api.get("/v1/groups/g1/users")).rejects.not.toBeInstanceOf(
      MockHttpError
    );
  });

  it("callsTo(): filters the call log by method and path template", async () => {
    const api = new MockApiManager()
      .respond("GET", P, { users: [] })
      .respond("DELETE", "/v1/groups/:groupId", { message: "ok" });

    await api.get("/v1/groups/g1/users");
    await api.get("/v1/groups/g2/users");
    await api.delete("/v1/groups/g1");

    expect(api.callsTo("GET", P)).toHaveLength(2);
    expect(api.callsTo("DELETE", "/v1/groups/:groupId")).toHaveLength(1);
    expect(api.callsTo("POST", P)).toHaveLength(0);
  });

  it("unmatched calls still 404 (routes consumed by times are skipped)", async () => {
    const api = new MockApiManager().failOnce("GET", P, 500);

    await expect(api.get("/v1/groups/g1/users")).rejects.toThrow("500");
    await expect(api.get("/v1/groups/g1/users")).rejects.toThrow(
      /No mock route/
    );
  });

  it("query strings are parsed, logged, and handed to handlers (pagination)", async () => {
    const handler = jest.fn(({ query }) => ({ users: [], page: query.page }));
    const api = new MockApiManager().on("GET", P, handler);

    await expect(api.get("/v1/groups/g1/users?page=2&limit=10")).resolves.toEqual({
      users: [],
      page: "2",
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: "2", limit: "10" } })
    );
    expect(api.callsTo("GET", P)[0].query).toEqual({ page: "2", limit: "10" });
  });

  it("a second persistent route for the same template throws (duplicate detection)", () => {
    const api = new MockApiManager().respond("GET", P, { users: [] });

    expect(() => api.respond("GET", "/v1/groups/{groupId}/users", { users: [] })).toThrow(
      /Duplicate persistent route/
    );
    // finite-times routes are the sanctioned way to layer the same template
    expect(() => api.failOnce("GET", P, 500)).not.toThrow();
  });

  it("reset() clears routes and the call log", async () => {
    const api = new MockApiManager().respond("GET", P, { users: [] });
    await api.get("/v1/groups/g1/users");

    api.reset();

    expect(api.calls).toHaveLength(0);
    await expect(api.get("/v1/groups/g1/users")).rejects.toThrow(/No mock route/);
    // and re-registering the same persistent template is allowed again
    expect(() => api.respond("GET", P, { users: [] })).not.toThrow();
  });

  it("delayMs introduces real latency before the handler runs", async () => {
    const api = new MockApiManager().respond("GET", P, { users: [] }, { delayMs: 30 });

    const started = Date.now();
    await api.get("/v1/groups/g1/users");
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  });
});
