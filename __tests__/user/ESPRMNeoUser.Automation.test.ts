/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for ESPRMNeoAutomation INSTANCE methods:
 *   update, delete, addCondition, removeCondition, addAction, removeAction
 *
 * ★ Runs on the shared SDK test harness. The old file's group-level automation
 * describes (getAutomations / getAutomation / createAutomation) were dropped:
 * they duplicated `group/ESPRMNeoGroup.automation.test.ts`, which covers the
 * same surface with `validated()` fixtures and request-contract assertions.
 */

import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoAutomation } from "../../src/ESPRMNeoAutomation";
import { ESPRMNeoGroup } from "../../src/ESPRMNeoGroup";
import {
  MOCK_GROUP_ID,
  MOCK_AUTOMATION_ID,
  MOCK_AUTOMATION_DATA,
} from "../helpers/automation";

// Known quirk (confirmed intentional 2026-07-28): update() sends `retrigger`,
// which the spec's AutomationPayload does NOT declare. Confirmed intentional —
// the SDK sends it deliberately and the backend accepts undeclared keys, so
// the request succeeds. The opt-out stays HERE ONLY because closed-world
// request validation enforces the spec, and the spec still omits the field;
// re-enable if/when AutomationPayload documents `retrigger`.
const h = setupSdkTest({ validateRequests: false });

const AUTOMATION_ROUTE = "/v1/groups/:gid/service/automations/:aid";

function makeAutomation(): ESPRMNeoAutomation {
  const group = new ESPRMNeoGroup({
    groupId: MOCK_GROUP_ID,
    groupName: "Test Group",
    nodeIds: [],
  });
  return new ESPRMNeoAutomation(
    { id: MOCK_AUTOMATION_ID, ...MOCK_AUTOMATION_DATA },
    group
  );
}

describe("ESPRMNeoAutomation.update", () => {
  it("should update automation successfully", async () => {
    const automation = makeAutomation();
    h.api.respond("PUT", AUTOMATION_ROUTE, {});

    await automation.update({ name: "Updated Name" });

    const call = h.api.callsTo("PUT", AUTOMATION_ROUTE)[0];
    expect(call.path).toBe(
      `/v1/groups/${MOCK_GROUP_ID}/service/automations/${MOCK_AUTOMATION_ID}`
    );
    expect(call.data).toEqual(expect.objectContaining({ name: "Updated Name" }));
    expect(automation.name).toBe("Updated Name");
  });

  it("should update status to disabled", async () => {
    const automation = makeAutomation();
    h.api.respond("PUT", AUTOMATION_ROUTE, {});

    await automation.update({ status: "disabled" });

    expect(h.api.callsTo("PUT", AUTOMATION_ROUTE)[0].data).toEqual(
      expect.objectContaining({ status: "disabled" })
    );
    expect(automation.status).toBe("disabled");
  });

  it("should update status back to enabled", async () => {
    const automation = makeAutomation();
    automation.status = "disabled";
    h.api.respond("PUT", AUTOMATION_ROUTE, {});

    await automation.update({ status: "enabled" });

    expect(h.api.callsTo("PUT", AUTOMATION_ROUTE)[0].data).toEqual(
      expect.objectContaining({ status: "enabled" })
    );
    expect(automation.status).toBe("enabled");
  });
});

describe("ESPRMNeoAutomation.delete", () => {
  it("should delete automation successfully", async () => {
    const automation = makeAutomation();
    h.api.respond("DELETE", AUTOMATION_ROUTE, {});

    await automation.delete();

    expect(h.api.callsTo("DELETE", AUTOMATION_ROUTE)[0].path).toBe(
      `/v1/groups/${MOCK_GROUP_ID}/service/automations/${MOCK_AUTOMATION_ID}`
    );
  });
});

describe("ESPRMNeoAutomation.addCondition", () => {
  it("should add trigger condition", async () => {
    const automation = makeAutomation();
    h.api.respond("PUT", AUTOMATION_ROUTE, {});
    const initialLength = automation.conditions.and.length;

    await automation.addCondition("trigger3");

    expect(automation.conditions.and.length).toBe(initialLength + 1);
    expect(automation.conditions.and).toContain("trigger3");
    expect(h.api.callsTo("PUT", AUTOMATION_ROUTE)).toHaveLength(1);
  });

  it("should not add duplicate trigger condition", async () => {
    const automation = makeAutomation();
    h.api.respond("PUT", AUTOMATION_ROUTE, {});
    automation.conditions.and = ["trigger1"];

    await automation.addCondition("trigger1");

    expect(automation.conditions.and.length).toBe(1);
  });
});

describe("ESPRMNeoAutomation.removeCondition", () => {
  it("should remove trigger condition", async () => {
    const automation = makeAutomation();
    h.api.respond("PUT", AUTOMATION_ROUTE, {});
    automation.conditions.and = ["trigger1", "trigger2"];

    await automation.removeCondition("trigger1");

    expect(automation.conditions.and).not.toContain("trigger1");
    expect(automation.conditions.and).toContain("trigger2");
    expect(h.api.callsTo("PUT", AUTOMATION_ROUTE)).toHaveLength(1);
  });
});

describe("ESPRMNeoAutomation.addAction", () => {
  it("should add action target", async () => {
    const automation = makeAutomation();
    h.api.respond("PUT", AUTOMATION_ROUTE, {});
    const newTarget = { node: "node2", path: "Switch.Power", value: false };
    const initialLength = automation.actions.targets.length;

    await automation.addAction(newTarget);

    expect(automation.actions.targets.length).toBe(initialLength + 1);
    expect(automation.actions.targets).toContainEqual(newTarget);
    expect(h.api.callsTo("PUT", AUTOMATION_ROUTE)).toHaveLength(1);
  });
});

describe("ESPRMNeoAutomation.removeAction", () => {
  it("should remove action target by index", async () => {
    const automation = makeAutomation();
    h.api.respond("PUT", AUTOMATION_ROUTE, {});
    automation.actions.targets = [
      { node: "node1", path: "Light.Power", value: true },
      { node: "node2", path: "Switch.Power", value: false },
    ];

    await automation.removeAction(0);

    expect(automation.actions.targets.length).toBe(1);
    expect(automation.actions.targets[0].node).toBe("node2");
    expect(h.api.callsTo("PUT", AUTOMATION_ROUTE)).toHaveLength(1);
  });

  it("should throw error for invalid index", async () => {
    const automation = makeAutomation();

    await expect(automation.removeAction(999)).rejects.toThrow(
      "Invalid action index"
    );
    expect(h.api.calls).toHaveLength(0);
  });
});
