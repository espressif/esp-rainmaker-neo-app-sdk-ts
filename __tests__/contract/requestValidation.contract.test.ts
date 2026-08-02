/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Contract tests for the request-validation machinery itself:
 * the generator exports `request:METHOD /path` schemas, `expectValidRequest`
 * resolves them placeholder-agnostically, and MockApiManager rejects bodies
 * the spec forbids before any handler runs.
 */

import {
  availableSchemas,
  expectValidRequest,
  requestSchemaFor,
} from "../../test-utils/schema-validator";
import { MockApiManager } from "../../test-utils/mock-server";

describe("Contract: request-body validation", () => {
  it("the bundle exports a request schema for every tracked requestBody op", () => {
    const requestSchemas = availableSchemas().filter((n) =>
      String(n).startsWith("request:")
    );
    // 20 tracked operations declare requestBody: true (config.mjs).
    expect(requestSchemas.length).toBeGreaterThanOrEqual(20);
  });

  it("requestSchemaFor is placeholder-name agnostic", () => {
    expect(requestSchemaFor("POST", "/v1/groups/{groupId}/sharing-requests")).toBe(
      "request:POST /v1/groups/{groupId}/sharing-requests"
    );
    expect(requestSchemaFor("post", "/v1/groups/:gid/sharing-requests")).toBe(
      "request:POST /v1/groups/{groupId}/sharing-requests"
    );
    expect(requestSchemaFor("GET", "/v1/groups")).toBeUndefined();
  });

  it("expectValidRequest accepts a spec-conformant body", () => {
    expect(() =>
      expectValidRequest("POST /v1/groups", { group_name: "Home" })
    ).not.toThrow();
  });

  it("expectValidRequest rejects a body that violates the spec", () => {
    // group_name must be a string per CreateGroupRequest.
    expect(() =>
      expectValidRequest("POST /v1/groups", { group_name: 123 })
    ).toThrow(/Schema validation failed/);
  });

  it("expectValidRequest fails loudly on an unknown/untracked operation key", () => {
    expect(() =>
      expectValidRequest("POST /v1/does/not/exist", { a: 1 })
    ).toThrow(/No request schema/);
  });

  it("MockApiManager rejects an invalid body before the handler runs", async () => {
    const handler = jest.fn().mockReturnValue({ group_id: "g1" });
    const api = new MockApiManager().on("POST", "/v1/groups", handler);

    await expect(api.post("/v1/groups", { group_name: 123 })).rejects.toThrow(
      /SDK built an invalid request body for POST \/v1\/groups/
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("MockApiManager passes a valid body through to the handler", async () => {
    const handler = jest.fn().mockReturnValue({ group_id: "g1" });
    const api = new MockApiManager().on("POST", "/v1/groups", handler);

    await expect(api.post("/v1/groups", { group_name: "Home" })).resolves.toEqual({
      group_id: "g1",
    });
    expect(handler).toHaveBeenCalled();
  });

  it("validateRequests: false opts out for failure-mode scenarios", async () => {
    const handler = jest.fn().mockReturnValue({ group_id: "g1" });
    const api = new MockApiManager({ validateRequests: false }).on(
      "POST",
      "/v1/groups",
      handler
    );

    await expect(api.post("/v1/groups", { group_name: 123 })).resolves.toEqual({
      group_id: "g1",
    });
  });
});
