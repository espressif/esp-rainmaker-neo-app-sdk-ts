/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for the schedule lifecycle surfaces that had no request-body
 * coverage: `ESPRMNeoSchedule.update/delete` and the user-level
 * `createSchedule` / `updateSchedule` / `deleteSchedule`. (`syncSchedulesList`
 * was removed in the version-1 rewrite; the
 * `/v1/schedules` path it called never existed in the backend.)
 *
 * All write paths funnel into `PUT /v1/groups/{groupId}/nodes/{nodeId}/schedules`
 * — a tracked request contract, so the harness auto-validates every PUT body
 * (each item requires `name`/`triggers`/`action`). The node-level
 * `createSchedule` contracts live in `ESPRMNeoUser.methods.test.ts`;
 * this file covers the layers above them: merge/filter semantics and the
 * getGroups→getNode plumbing.
 *
 * Schedule GET responses use raw payloads — their response schemas are not in
 * the exported bundle yet (same tracked gap as `ESPRMNeoUser.methods.test.ts`).
 */

import { validated } from "../../test-utils/response-builder";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoSchedule } from "../../src/ESPRMNeoSchedule";
import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { NodeConfigAPI } from "../../src/types/output";
import { ScheduleItem } from "../../src/types/schedule";
import { StorageKeys } from "../../src/utils/constants";

const h = setupSdkTest();

const GROUP_ID = "grp-sched";
const NODE_ID = "node-sched-1";
const SCHEDULES_ROUTE = "/v1/groups/:gid/nodes/:nid/schedules";
const SCHEDULES_PATH = `/v1/groups/${GROUP_ID}/nodes/${NODE_ID}/schedules`;

const SCHEDULE_A: ScheduleItem = {
  id: "sched-a",
  name: "Morning",
  enabled: true,
  triggers: [{ m: 480, d: 31 }],
  action: { "light-1": { Power: true } },
};

const SCHEDULE_B: ScheduleItem = {
  id: "sched-b",
  name: "Evening",
  enabled: false,
  triggers: [{ m: 1200, d: 31 }],
  action: { "light-1": { Power: false } },
};

function makeNode(): ESPRMNeoNode {
  return new ESPRMNeoNode(
    { node_id: NODE_ID, devices: [], services: [] } as NodeConfigAPI,
    GROUP_ID
  );
}

/** The single PUT to the schedules endpoint — asserts exactly one was made. */
function thePutBody(): { schedules: ScheduleItem[] } {
  const calls = h.api.callsTo("PUT", SCHEDULES_ROUTE);
  expect(calls).toHaveLength(1);
  expect(calls[0].path).toBe(SCHEDULES_PATH);
  return calls[0].data as { schedules: ScheduleItem[] };
}

/** Routes GET /v1/groups + the node-config storage cache for user-level methods. */
function primeUserPlumbing() {
  h.api.respond(
    "GET",
    "/v1/groups",
    validated("ListGroupsResponse", {
      groups: [
        {
          group_id: GROUP_ID,
          group_name: "Scheduled Home",
          access_type: "primary",
          node_ids: [NODE_ID],
        },
      ],
    })
  );
  h.storage.getItem.mockImplementation(((key: string) =>
    key === `${StorageKeys.NODE_CONFIG_PREFIX}${NODE_ID}`
      ? Promise.resolve(
          JSON.stringify({ node_id: NODE_ID, devices: [], services: [] })
        )
      : Promise.resolve(null)) as never);
}

// ===========================================================================
// ESPRMNeoSchedule.update / .delete — instance methods over the full-list PUT
// ===========================================================================
describe("ESPRMNeoSchedule.update", () => {
  it("merges the changes and PUTs the full list with the updated item", async () => {
    const node = makeNode();
    h.api.respond("GET", SCHEDULES_ROUTE, {
      schedules: [SCHEDULE_A, SCHEDULE_B],
    });
    h.api.respond("PUT", SCHEDULES_ROUTE, {});

    const [scheduleA] = await node.getSchedules();
    await scheduleA.update({ enabled: false });

    expect(scheduleA.enabled).toBe(false);
    expect(thePutBody()).toEqual({
      schedules: [{ ...SCHEDULE_A, enabled: false }, SCHEDULE_B],
    });
  });

  it("failure mode: throws when the schedule no longer exists on the node", async () => {
    const node = makeNode();
    h.api.respond("GET", SCHEDULES_ROUTE, { schedules: [SCHEDULE_B] });

    const orphan = new ESPRMNeoSchedule(
      SCHEDULE_A,
      NODE_ID,
      GROUP_ID,
      SCHEDULE_A.id,
      node
    );

    await expect(orphan.update({ enabled: false })).rejects.toThrow(
      "Schedule not found on the node"
    );
    expect(h.api.callsTo("PUT", SCHEDULES_ROUTE)).toHaveLength(0);
  });
});

describe("ESPRMNeoSchedule.delete", () => {
  it("PUTs the list without the deleted schedule", async () => {
    const node = makeNode();
    h.api.respond("GET", SCHEDULES_ROUTE, {
      schedules: [SCHEDULE_A, SCHEDULE_B],
    });
    h.api.respond("PUT", SCHEDULES_ROUTE, {});

    const [scheduleA] = await node.getSchedules();
    await scheduleA.delete();

    expect(thePutBody()).toEqual({ schedules: [SCHEDULE_B] });
  });
});

