/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for ESPRMNeoGroup automation methods:
 *   getAutomation, getAutomations, createAutomation
 *
 * The backend returns automations FLAT: `{ id, ...AutomationPayload }` (the
 * swagger Automation schema is an allOf merge, not a nested payload object).
 * The SDK wraps each item in an ESPRMNeoAutomation instance.
 *
 * ★ Runs on the shared SDK test harness. Request bodies are auto-validated by
 * `h.api`; input-validation guards (missing name / conditions /
 * actions) are tested to confirm they throw before any HTTP call.
 */

import { validated } from "../../test-utils/response-builder";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoAutomation } from "../../src/ESPRMNeoAutomation";
import { ESPRMNeoGroup } from "../../src/ESPRMNeoGroup";
import type { AutomationItem, CreateAutomationInput } from "../../src/types/automation";

const h = setupSdkTest();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_ID = "grp-home";

const AUTOMATIONS_ROUTE = "/v1/groups/:gid/service/automations";
const AUTOMATION_ROUTE  = "/v1/groups/:gid/service/automations/:aid";

function makeGroup(): ESPRMNeoGroup {
  return new ESPRMNeoGroup({
    groupId: GROUP_ID,
    groupName: "Home",
    accessType: "primary",
    nodeIds: [],
  });
}

// AutomationActionTarget fields: { node, path, value } (matches both SDK type and swagger)
const SAMPLE_ACTION_TARGET = { node: "node-1", path: "Light.Power", value: true };

/** Minimal valid Automation response body (matches swagger Automation schema).
 * The spec's Automation = { id } & AutomationPayload — FLAT fields with
 * `status: "enabled"|"disabled"`, NOT nested under `payload` (an earlier
 * version of this helper had that wrong; it slipped through validated()
 * because AutomationPayload declares no required fields). */
function automationBody(id: string, name: string) {
  return {
    id,
    name,
    conditions: { and: ["node-1~auto-001~0"] },
    actions: { targets: [SAMPLE_ACTION_TARGET] },
    status: "enabled",
  };
}

function automationResponse(id: string, name: string) {
  return validated("Automation", automationBody(id, name));
}

/** Minimal valid CreateAutomationInput.
 * Note: the SDK-side type uses `status: "enabled" | "disabled"`; the wire
 * payload's `enabled: boolean` (see automationResponse above) is the
 * spec-side representation. */
const BASE_AUTOMATION: CreateAutomationInput = {
  name: "Turn on at sunset",
  conditions: { and: ["node-1~auto-001~0"] },
  actions: { targets: [SAMPLE_ACTION_TARGET] },
  status: "enabled",
};

// ===========================================================================
// getAutomation()
// ===========================================================================
describe("ESPRMNeoGroup.getAutomation", () => {
  const AUTOMATION_ID = "auto-001";

  it("happy path: maps API response to an ESPRMNeoAutomation instance", async () => {
    h.api.respond(
      "GET",
      AUTOMATION_ROUTE,
      automationResponse(AUTOMATION_ID, "Turn on at sunset")
    );

    const automation = await makeGroup().getAutomation(AUTOMATION_ID);

    expect(automation).toBeInstanceOf(ESPRMNeoAutomation);
    expect(automation.id).toBe(AUTOMATION_ID);
    expect(automation.name).toBe("Turn on at sunset");
  });

  it("request contract: GETs /v1/groups/{groupId}/service/automations/{automationId}", async () => {
    h.api.respond(
      "GET",
      AUTOMATION_ROUTE,
      automationResponse(AUTOMATION_ID, "Turn on at sunset")
    );

    await makeGroup().getAutomation(AUTOMATION_ID);

    const calls = h.api.callsTo("GET", AUTOMATION_ROUTE);
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(
      `/v1/groups/${GROUP_ID}/service/automations/${AUTOMATION_ID}`
    );
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("GET", AUTOMATION_ROUTE, 404);

    await expect(makeGroup().getAutomation(AUTOMATION_ID)).rejects.toThrow(
      "HTTP error! status: 404"
    );
  });
});

// ===========================================================================
// getAutomations()
// ===========================================================================
describe("ESPRMNeoGroup.getAutomations", () => {
  it("happy path: maps array response to ESPRMNeoAutomation instances", async () => {
    h.api.respond(
      "GET",
      AUTOMATIONS_ROUTE,
      validated("ListAutomationsResponse", {
        automations: [
          automationBody("auto-001", "Turn on at sunset"),
          automationBody("auto-002", "Turn off at midnight"),
        ],
      })
    );

    const automations = await makeGroup().getAutomations();

    expect(automations).toHaveLength(2);
    automations.forEach((a) => expect(a).toBeInstanceOf(ESPRMNeoAutomation));
    expect(automations[0].id).toBe("auto-001");
    expect(automations[1].id).toBe("auto-002");
  });

  it("request contract: GETs /v1/groups/{groupId}/service/automations", async () => {
    h.api.respond(
      "GET",
      AUTOMATIONS_ROUTE,
      validated("ListAutomationsResponse", { automations: [] })
    );

    await makeGroup().getAutomations();

    expect(h.api.callsTo("GET", AUTOMATIONS_ROUTE)[0].path).toBe(
      `/v1/groups/${GROUP_ID}/service/automations`
    );
  });

  it("edge case: empty array resolves to an empty list", async () => {
    h.api.respond(
      "GET",
      AUTOMATIONS_ROUTE,
      validated("ListAutomationsResponse", { automations: [] })
    );

    const automations = await makeGroup().getAutomations();

    expect(automations).toEqual([]);
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("GET", AUTOMATIONS_ROUTE, 403);

    await expect(makeGroup().getAutomations()).rejects.toThrow(
      "HTTP error! status: 403"
    );
  });
});

// ===========================================================================
// createAutomation()
// ===========================================================================
describe("ESPRMNeoGroup.createAutomation", () => {
  it("happy path: returns an ESPRMNeoAutomation with the server-assigned id", async () => {
    h.api.respond(
      "POST",
      AUTOMATIONS_ROUTE,
      validated("AutomationWriteResponse", { automation_id: "auto-new-001" })
    );

    const automation = await makeGroup().createAutomation(BASE_AUTOMATION);

    expect(automation).toBeInstanceOf(ESPRMNeoAutomation);
    expect(automation.id).toBe("auto-new-001");
    expect(automation.name).toBe(BASE_AUTOMATION.name);
  });

  it("request contract: POSTs /v1/groups/{groupId}/service/automations with automation payload", async () => {
    h.api.respond(
      "POST",
      AUTOMATIONS_ROUTE,
      validated("AutomationWriteResponse", { automation_id: "auto-x" })
    );

    await makeGroup().createAutomation(BASE_AUTOMATION);

    const call = h.api.callsTo("POST", AUTOMATIONS_ROUTE)[0];
    expect(call.path).toBe(`/v1/groups/${GROUP_ID}/service/automations`);
    expect(call.data).toEqual(
      expect.objectContaining({
        name: BASE_AUTOMATION.name,
        conditions: BASE_AUTOMATION.conditions,
        actions: BASE_AUTOMATION.actions,
      })
    );
    // body shape vs spec is auto-checked by the harness
  });

  it("request contract: does NOT send the local id field to the API", async () => {
    h.api.respond(
      "POST",
      AUTOMATIONS_ROUTE,
      validated("AutomationWriteResponse", { automation_id: "auto-x" })
    );

    const withId: AutomationItem = { ...BASE_AUTOMATION, id: "local-id" };
    await makeGroup().createAutomation(withId);

    const body = h.api.callsTo("POST", AUTOMATIONS_ROUTE)[0].data;
    expect(body as Record<string, unknown>).not.toHaveProperty("id");
  });

  it("failure mode: missing name throws ESPAPICallValidationError before HTTP", async () => {
    const noName = { ...BASE_AUTOMATION, name: "" };

    await expect(makeGroup().createAutomation(noName)).rejects.toThrow();
    expect(h.api.calls).toHaveLength(0);
  });

  it("failure mode: missing conditions throws before HTTP", async () => {
    const noConditions = { ...BASE_AUTOMATION, conditions: undefined as never };

    await expect(makeGroup().createAutomation(noConditions)).rejects.toThrow();
    expect(h.api.calls).toHaveLength(0);
  });

  it("failure mode: missing actions throws before HTTP", async () => {
    const noActions = { ...BASE_AUTOMATION, actions: undefined as never };

    await expect(makeGroup().createAutomation(noActions)).rejects.toThrow();
    expect(h.api.calls).toHaveLength(0);
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("POST", AUTOMATIONS_ROUTE, 400);

    await expect(makeGroup().createAutomation(BASE_AUTOMATION)).rejects.toThrow(
      "HTTP error! status: 400"
    );
  });
});
