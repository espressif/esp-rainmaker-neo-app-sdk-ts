/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for node trigger methods.
 * ★ Runs on the shared SDK test harness.
 *
 * Every write path here funnels into
 * `PUT /v1/groups/{groupId}/nodes/{nodeId}/triggers` — a tracked request
 * contract, so the harness auto-validates each PUT body. The tests
 * assert the wire behavior the SDK layers on top: full-list replacement
 * semantics for add/update/delete.
 */

import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { ESPRMNeoTrigger } from "../../src/ESPRMNeoTrigger";
import { NodeConfigAPI } from "../../src/types/output";
import { TriggerItem } from "../../src/types/trigger";
import {
  MOCK_GROUP_ID,
  MOCK_NODE_ID,
  MOCK_GET_TRIGGER_RESPONSE,
} from "../helpers/trigger/utils";

const h = setupSdkTest();

const TRIGGERS_ROUTE = "/v1/groups/:gid/nodes/:nid/triggers";
const TRIGGERS_PATH = `/v1/groups/${MOCK_GROUP_ID}/nodes/${MOCK_NODE_ID}/triggers`;

function makeNode(): ESPRMNeoNode {
  return new ESPRMNeoNode(
    { node_id: MOCK_NODE_ID, devices: [], services: [] } as NodeConfigAPI,
    MOCK_GROUP_ID
  );
}

const TRIGGER_A: TriggerItem = {
  id: "trigger-a",
  type: "param",
  enabled: true,
  path: "Temperature Sensor.Temperature",
  operator: "gt",
  value: 25,
};

const TRIGGER_B: TriggerItem = {
  id: "trigger-b",
  type: "param",
  enabled: false,
  path: "Humidity Sensor.Humidity",
  operator: "lt",
  value: 40,
};

/** The single PUT to the triggers endpoint — asserts exactly one was made. */
function thePutBody(): { triggers: TriggerItem[] } {
  const calls = h.api.callsTo("PUT", TRIGGERS_ROUTE);
  expect(calls).toHaveLength(1);
  expect(calls[0].path).toBe(TRIGGERS_PATH);
  return calls[0].data as { triggers: TriggerItem[] };
}

describe("ESPRMNeoNode.getTriggers", () => {
  it("should get triggers for a node", async () => {
    const node = makeNode();
    // Trigger response schemas are not in the exported bundle yet (tracked
    // gap) — raw payload via a route, same as the schedule surfaces.
    h.api.respond("GET", TRIGGERS_ROUTE, MOCK_GET_TRIGGER_RESPONSE);

    const triggers = await node.getTriggers();

    expect(h.api.callsTo("GET", TRIGGERS_ROUTE)[0].path).toBe(TRIGGERS_PATH);
    expect(Array.isArray(triggers)).toBe(true);
  });

  it("maps trigger items to ESPRMNeoTrigger instances bound to the node", async () => {
    const node = makeNode();
    h.api.respond("GET", TRIGGERS_ROUTE, { triggers: [TRIGGER_A] });

    const [trigger] = await node.getTriggers();

    expect(trigger).toBeInstanceOf(ESPRMNeoTrigger);
    expect(trigger.id).toBe(TRIGGER_A.id);
    expect(trigger.path).toBe(TRIGGER_A.path);
    expect(trigger.operator).toBe(TRIGGER_A.operator);
    expect(trigger.value).toBe(TRIGGER_A.value);
    expect(trigger.nodeId).toBe(MOCK_NODE_ID);
    expect(trigger.groupId).toBe(MOCK_GROUP_ID);
  });
});

describe("ESPRMNeoNode.createTrigger", () => {
  it("request contract: PUTs the full trigger list when given an array (body auto-validated)", async () => {
    const node = makeNode();
    h.api.respond("PUT", TRIGGERS_ROUTE, {});

    const result = await node.createTrigger([TRIGGER_A, TRIGGER_B]);

    expect(thePutBody()).toEqual({ triggers: [TRIGGER_A, TRIGGER_B] });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: TRIGGER_A.id,
      nodeId: MOCK_NODE_ID,
      groupId: MOCK_GROUP_ID,
    });
    expect(result[1]).toMatchObject({
      id: TRIGGER_B.id,
      nodeId: MOCK_NODE_ID,
      groupId: MOCK_GROUP_ID,
    });
  });

  it("failure mode: API error propagates to the caller", async () => {
    const node = makeNode();
    h.api.fail("PUT", TRIGGERS_ROUTE, 400);

    await expect(node.createTrigger([TRIGGER_A])).rejects.toThrow(
      "HTTP error! status: 400"
    );
  });

  it("fetches existing triggers and PUTs the merged list when given one item", async () => {
    const node = makeNode();
    h.api.respond("GET", TRIGGERS_ROUTE, { triggers: [TRIGGER_A] });
    h.api.respond("PUT", TRIGGERS_ROUTE, {});

    const result = await node.createTrigger(TRIGGER_B);

    expect(h.api.callsTo("GET", TRIGGERS_ROUTE)).toHaveLength(1);
    expect(thePutBody()).toEqual({ triggers: [TRIGGER_A, TRIGGER_B] });
    expect(result).toMatchObject({
      id: TRIGGER_B.id,
      nodeId: MOCK_NODE_ID,
      groupId: MOCK_GROUP_ID,
    });
  });
});

describe("ESPRMNeoNode.removeAllTriggers", () => {
  it("DELETEs the triggers endpoint", async () => {
    const node = makeNode();
    h.api.respond("DELETE", TRIGGERS_ROUTE, {});

    await node.removeAllTriggers();

    expect(h.api.callsTo("DELETE", TRIGGERS_ROUTE)).toHaveLength(1);
  });
});

describe("ESPRMNeoNode.removeTrigger", () => {
  it("fetches existing triggers and PUTs the list without the removed id", async () => {
    const node = makeNode();
    h.api.respond("GET", TRIGGERS_ROUTE, { triggers: [TRIGGER_A, TRIGGER_B] });
    h.api.respond("PUT", TRIGGERS_ROUTE, {});

    await node.removeTrigger(TRIGGER_A.id);

    expect(h.api.callsTo("GET", TRIGGERS_ROUTE)).toHaveLength(1);
    expect(thePutBody()).toEqual({ triggers: [TRIGGER_B] });
  });
});

describe("ESPRMNeoTrigger.update", () => {
  it("applies the changes and PUTs the full list with the updated item", async () => {
    const node = makeNode();
    h.api.respond("GET", TRIGGERS_ROUTE, { triggers: [TRIGGER_A, TRIGGER_B] });
    h.api.respond("PUT", TRIGGERS_ROUTE, {});

    const [triggerA] = await node.getTriggers();
    await triggerA.update({ enabled: false, value: 30 });

    expect(triggerA.enabled).toBe(false);
    expect(triggerA.value).toBe(30);
    expect(thePutBody()).toEqual({
      triggers: [{ ...TRIGGER_A, enabled: false, value: 30 }, TRIGGER_B],
    });
  });

  it("failure mode: throws when the trigger no longer exists on the node", async () => {
    const node = makeNode();
    const orphan = new ESPRMNeoTrigger(TRIGGER_A, node);
    h.api.respond("GET", TRIGGERS_ROUTE, { triggers: [TRIGGER_B] });

    await expect(orphan.update({ enabled: false })).rejects.toThrow(
      "Trigger not found on the node"
    );
    expect(h.api.callsTo("PUT", TRIGGERS_ROUTE)).toHaveLength(0);
  });
});

describe("ESPRMNeoTrigger.delete", () => {
  it("PUTs the list without the deleted trigger", async () => {
    const node = makeNode();
    h.api.respond("GET", TRIGGERS_ROUTE, { triggers: [TRIGGER_A, TRIGGER_B] });
    h.api.respond("PUT", TRIGGERS_ROUTE, {});

    const [triggerA] = await node.getTriggers();
    await triggerA.delete();

    expect(thePutBody()).toEqual({ triggers: [TRIGGER_B] });
  });
});
