/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Self-tests for setupSdkTest(): one call must wire the whole
 * boundary — mock API, storage, base config, tokens — and drive REAL SDK
 * methods end-to-end with no per-file jest.mock boilerplate at all.
 */

import { validated, validatedError } from "../../test-utils/response-builder";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";

const h = setupSdkTest();

describe("setupSdkTest", () => {
  it("drives a real SDK method through the mock API with zero boilerplate", async () => {
    h.api.respond(
      "GET",
      "/v1/groups",
      validated("ListGroupsResponse", {
        groups: [{ group_id: "g1", group_name: "Home", access_type: "primary" }],
      })
    );

    const groups = await h.user().getGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].groupId).toBe("g1");
    expect(h.api.callsTo("GET", "/v1/groups")).toHaveLength(1);
  });

  it("methods are registered without per-file imports", async () => {
    const user = h.user();
    // A sample across method families that previously needed manual imports:
    expect(typeof user.getGroups).toBe("function");
    expect(typeof user.createGroup).toBe("function");
    expect(typeof user.listSharingRequests).toBe("function");
    expect(typeof user.getUserInfo).toBe("function");
  });

  it("request bodies are auto-validated through the harness", async () => {
    h.api.respond(
      "POST",
      "/v1/groups",
      validated("CreateGroupResponse", { group_id: "g-new" })
    );

    await expect(h.user().createGroup("Home")).resolves.toBeDefined();
    // the mock server validated the SDK-built body before the handler ran
    expect(h.api.callsTo("POST", "/v1/groups")).toHaveLength(1);
  });

  it("fault injection: 500 propagates like the real API manager", async () => {
    h.api.fail("GET", "/v1/groups", 500, {
      body: validatedError("ApiError", { message: "boom" }),
    });

    await expect(h.user().getGroups()).rejects.toThrow("HTTP error! status: 500");
  });

  it("storage defaults are primed and overridable per test", async () => {
    await expect(h.storage.getItem("anything")).resolves.toBeNull();

    h.storage.getItem.mockResolvedValue("cached");
    await expect(h.storage.getItem("anything")).resolves.toBe("cached");
  });

  it("config overrides flow through ESPRMNeoBase.getConfig", () => {
    // default from the harness
    expect(h.user()).toBeDefined();
    const { ESPRMNeoBase } = jest.requireActual("../../src/ESPRMNeoBase");
    expect(ESPRMNeoBase.getConfig().baseUrl).toBe("https://api.test.local");
  });

  it("a fresh MockApiManager per test — no route bleed from earlier tests", async () => {
    // Routes registered in previous `it` blocks must be gone.
    await expect(h.user().getGroups()).rejects.toThrow(/No mock route/);
    expect(h.api.calls).toHaveLength(1);
  });
});
