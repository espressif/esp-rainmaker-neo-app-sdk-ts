/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for `ESPRMNeoUser` instance methods (and the group/node schedule
 * surfaces reached through them).
 *
 * ★ Runs on the shared SDK test harness: `setupSdkTest()` wires the whole
 * boundary. SigV4 REST surfaces are routes on `h.api`; User Auth REST goes
 * through `h.userApi`; storage through `h.storage`. `getTemporaryAWSCredentials`
 * uses raw `fetch` in src, so its tests mock `global.fetch` — that IS the
 * real boundary for that method, not a legacy mocking pattern.
 *
 * Schedule payloads still use the explicit `legacyUnvalidated()` escape
 * hatch: their response schemas are not in the exported bundle yet
 * (tracked-surface gap; convert when the schemas are added to config.mjs).
 */

import { validated, type ValidatedAny, type InvalidResponse } from "../../test-utils/response-builder";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPRMNeoGroup } from "../../src/ESPRMNeoGroup";
import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { ESPRMNeoSchedule } from "../../src/ESPRMNeoSchedule";
import { ESPRMNeoSharingRequest } from "../../src/ESPRMNeoSharingRequest";
import { NodeConfigAPI } from "../../src/types/output";

const h = setupSdkTest();

const legacyUnvalidated = (payload: unknown): ValidatedAny =>
  payload as ValidatedAny;

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const SCHEDULES_ROUTE = "/v1/groups/:gid/nodes/:nid/schedules";

function nodeConfig(nodeId: string): NodeConfigAPI {
  return { node_id: nodeId, devices: [], services: [] } as NodeConfigAPI;
}

// ===========================================================================
// getGroups — GET /v1/groups
// ===========================================================================
describe("getGroups", () => {
  it("happy path: maps the group list to ESPRMNeoGroup instances", async () => {
    h.api.respond(
      "GET",
      "/v1/groups",
      validated("ListGroupsResponse", {
        groups: [
          {
            group_id: "grp-1",
            group_name: "Home",
            access_type: "primary",
            node_ids: ["node-1", "node-2"],
            subgroups: [
              { subgroup_id: "sub-1", subgroup_name: "Living Room", node_ids: ["node-1"] },
            ],
          },
          {
            group_id: "grp-2",
            group_name: "Office",
            access_type: "secondary",
            node_ids: [],
          },
        ],
      })
    );

    const groups = await h.user().getGroups();

    expect(groups).toHaveLength(2);
    expect(groups[0]).toBeInstanceOf(ESPRMNeoGroup);
    expect(groups[0].groupId).toBe("grp-1");
    expect(groups[0].groupName).toBe("Home");
    expect(groups[0].accessType).toBe("primary");
    expect(groups[0].nodeIds).toEqual(["node-1", "node-2"]);
    const [subgroup] = groups[0].subgroups ?? [];
    expect(subgroup).toBeInstanceOf(ESPRMNeoGroup);
    expect(subgroup.groupId).toBe("sub-1");
    expect(subgroup.parentId).toBe("grp-1");
  });

  it("request contract: GETs /v1/groups", async () => {
    const response = validated("ListGroupsResponse", { groups: [] });
    h.api.respond("GET", "/v1/groups", response);

    await h.user().getGroups();

    expect(h.api.callsTo("GET", "/v1/groups")).toHaveLength(1);
  });

  it("edge case: an empty group list resolves to an empty array", async () => {
    h.api.respond("GET", "/v1/groups", validated("ListGroupsResponse", { groups: [] }));

    await expect(h.user().getGroups()).resolves.toEqual([]);
  });

  it("should skip nodes not found in storage when fromCloud is false", async () => {
    const group = new ESPRMNeoGroup({
      groupId: "test-group-id",
      groupName: "Test Group",
      nodeIds: ["test-node-id-1", "test-node-id-2"],
      subgroups: [],
    });

    h.storage.getNodeConfig.mockImplementation(((nodeId: string) => {
      if (nodeId === "test-node-id-1") {
        return Promise.resolve(nodeConfig("test-node-id-1"));
      }
      return Promise.resolve(null);
    }) as never);

    const result = await group.getNodes({ cache: true });

    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe("test-node-id-1");
  });
});

// ===========================================================================
// ESPRMNeoGroup.getSchedules — fans out GET .../nodes/{nodeId}/schedules
// ===========================================================================
describe("ESPRMNeoGroup.getSchedules", () => {
  const mockSchedule1 = {
    enabled: true,
    triggers: [{ m: 30 }],
    action: { device1: { param1: "value1" } },
  };
  const mockSchedule2 = {
    enabled: false,
    triggers: [{ m: 60 }],
    action: { device2: { param2: "value2" } },
  };

  it("should successfully get all schedules for all nodes in group", async () => {
    const group = new ESPRMNeoGroup({
      groupId: "test-group-id",
      groupName: "Test Group",
      nodeIds: ["test-node-id-1", "test-node-id-2"],
      subgroups: [],
    });

    h.api.on("GET", SCHEDULES_ROUTE, ({ params }) => {
      if (params.nid === "test-node-id-1")
        return legacyUnvalidated({ schedules: [mockSchedule1] });
      if (params.nid === "test-node-id-2")
        return legacyUnvalidated({ schedules: [mockSchedule2] });
      return legacyUnvalidated({ schedules: [] });
    });

    const result = await group.getSchedules();

    expect(h.api.callsTo("GET", SCHEDULES_ROUTE)).toHaveLength(2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(ESPRMNeoSchedule);
    const byNodeId = result.sort(
      (a: { nodeId: string }, b: { nodeId: string }) =>
        a.nodeId.localeCompare(b.nodeId)
    );
    expect(byNodeId[0].nodeId).toBe("test-node-id-1");
    expect(byNodeId[0].groupId).toBe("test-group-id");
    expect(byNodeId[0].enabled).toBe(true);
    expect(byNodeId[1].nodeId).toBe("test-node-id-2");
    expect(byNodeId[1].enabled).toBe(false);
  });

  it("should return empty array when group has no nodes", async () => {
    const group = new ESPRMNeoGroup({
      groupId: "test-group-id",
      groupName: "Test Group",
      nodeIds: [],
      subgroups: [],
    });

    const result = await group.getSchedules();

    expect(result).toEqual([]);
    expect(h.api.calls).toHaveLength(0);
  });

  it("should handle multiple schedules per node", async () => {
    const group = new ESPRMNeoGroup({
      groupId: "test-group-id",
      groupName: "Test Group",
      nodeIds: ["test-node-id-1"],
      subgroups: [],
    });

    h.api.respond(
      "GET",
      SCHEDULES_ROUTE,
      legacyUnvalidated({ schedules: [mockSchedule1, mockSchedule2] })
    );

    const result = await group.getSchedules();

    expect(h.api.callsTo("GET", SCHEDULES_ROUTE)[0].path).toBe(
      "/v1/groups/test-group-id/nodes/test-node-id-1/schedules"
    );
    expect(result).toHaveLength(2);
    expect(result[0].nodeId).toBe("test-node-id-1");
    expect(result[1].nodeId).toBe("test-node-id-1");
  });
});

// ===========================================================================
// ESPRMNeoGroup.createSchedule / deleteAllSchedules — delegate to node methods
// ===========================================================================
describe("ESPRMNeoGroup.createSchedule", () => {
  it("should successfully create schedules for multiple nodes", async () => {
    const schedule1 = { enabled: true, triggers: [{ m: 30 }], action: { device1: { param1: "value1" } } };
    const schedule2 = { enabled: false, triggers: [{ m: 60 }], action: { device2: { param2: "value2" } } };

    const group = new ESPRMNeoGroup({
      groupId: "test-group-id",
      groupName: "Test Group",
      nodeIds: ["test-node-id-1", "test-node-id-2"],
      subgroups: [],
    });

    const mockNode1 = new ESPRMNeoNode(nodeConfig("test-node-id-1"), "test-group-id");
    const mockNode2 = new ESPRMNeoNode(nodeConfig("test-node-id-2"), "test-group-id");
    const created1 = [
      new ESPRMNeoSchedule(schedule1, "test-node-id-1", "test-group-id", "s1", mockNode1),
    ];
    const created2 = [
      new ESPRMNeoSchedule(schedule2, "test-node-id-2", "test-group-id", "s2", mockNode2),
    ];
    mockNode1.createSchedule = jest.fn().mockResolvedValue(created1);
    mockNode2.createSchedule = jest.fn().mockResolvedValue(created2);
    group.getNodes = jest.fn().mockResolvedValue([mockNode1, mockNode2]);

    const result = await group.createSchedule([
      { nodeId: "test-node-id-1", schedules: [schedule1] },
      { nodeId: "test-node-id-2", schedules: [schedule2] },
    ]);

    expect(mockNode1.createSchedule).toHaveBeenCalledWith([schedule1]);
    expect(mockNode2.createSchedule).toHaveBeenCalledWith([schedule2]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(ESPRMNeoSchedule);
    expect(result[0]).toMatchObject({
      id: "s1",
      nodeId: "test-node-id-1",
      groupId: "test-group-id",
      enabled: true,
    });
    expect(result[1]).toMatchObject({
      id: "s2",
      nodeId: "test-node-id-2",
      groupId: "test-group-id",
      enabled: false,
    });
  });

  it("should handle empty schedules array", async () => {
    const group = new ESPRMNeoGroup({
      groupId: "test-group-id",
      groupName: "Test Group",
      nodeIds: [],
      subgroups: [],
    });

    group.getNodes = jest.fn().mockResolvedValue([]);

    const result = await group.createSchedule([]);

    expect(group.getNodes).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

describe("ESPRMNeoGroup.deleteAllSchedules", () => {
  it("should successfully delete all schedules for all nodes in group", async () => {
    const group = new ESPRMNeoGroup({
      groupId: "test-group-id",
      groupName: "Test Group",
      nodeIds: ["test-node-id-1"],
      subgroups: [],
    });

    const mockNode1 = new ESPRMNeoNode(nodeConfig("test-node-id-1"), "test-group-id");
    mockNode1.removeAllSchedules = jest.fn().mockResolvedValue(undefined);
    group.getNodes = jest.fn().mockResolvedValue([mockNode1]);

    await group.deleteAllSchedules();

    expect(group.getNodes).toHaveBeenCalledWith({ cache: false });
    expect(mockNode1.removeAllSchedules).toHaveBeenCalled();
  });

  it("should aggregate errors and throw when deleting schedules fails", async () => {
    const group = new ESPRMNeoGroup({
      groupId: "test-group-id",
      groupName: "Test Group",
      nodeIds: ["test-node-id-1"],
      subgroups: [],
    });

    const mockNode1 = new ESPRMNeoNode(nodeConfig("test-node-id-1"), "test-group-id");
    mockNode1.removeAllSchedules = jest
      .fn()
      .mockRejectedValue(new Error("Failed to delete schedules"));
    group.getNodes = jest.fn().mockResolvedValue([mockNode1]);

    await expect(group.deleteAllSchedules()).rejects.toThrow(
      "Failed to delete schedules"
    );

    expect(mockNode1.removeAllSchedules).toHaveBeenCalled();
  });
});

// ===========================================================================
// ESPRMNeoNode schedule methods — GET/PUT/DELETE .../nodes/{nodeId}/schedules
// ===========================================================================
describe("ESPRMNeoNode.getSchedules", () => {
  it("should successfully get all schedules for a node", async () => {
    const mockSchedule1 = { enabled: true, triggers: [{ m: 30 }], action: { device1: { param1: "value1" } } };
    const mockSchedule2 = { enabled: false, triggers: [{ m: 60 }], action: { device2: { param2: "value2" } } };

    const node = new ESPRMNeoNode(nodeConfig("test-node-id"), "test-group-id");
    h.api.respond(
      "GET",
      SCHEDULES_ROUTE,
      legacyUnvalidated({ schedules: [{ ...mockSchedule1, id: "s1" }, { ...mockSchedule2, id: "s2" }] })
    );

    const result = await node.getSchedules();

    expect(h.api.callsTo("GET", SCHEDULES_ROUTE)[0].path).toBe(
      "/v1/groups/test-group-id/nodes/test-node-id/schedules"
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(ESPRMNeoSchedule);
    expect(result[0].nodeId).toBe("test-node-id");
    expect(result[0].groupId).toBe("test-group-id");
    expect(result[0].enabled).toBe(true);
    expect(result[1].enabled).toBe(false);
  });

  it("should return empty array when no schedules exist", async () => {
    const node = new ESPRMNeoNode(nodeConfig("test-node-id"), "test-group-id");
    h.api.respond(
      "GET",
      SCHEDULES_ROUTE,
      legacyUnvalidated({ schedules: [] })
    );

    const result = await node.getSchedules();

    expect(result).toEqual([]);
  });
});

describe("ESPRMNeoNode.createSchedule", () => {
  it("should successfully set schedules for a node when given an array", async () => {
    // `name` is required by the spec's schedule request schema — the old
    // stub-based test never validated the PUT body, the harness does.
    const schedule1 = { name: "Morning", enabled: true, triggers: [{ m: 30 }], action: { device1: { param1: "value1" } } };
    const schedule2 = { name: "Evening", enabled: false, triggers: [{ m: 60 }], action: { device2: { param2: "value2" } } };

    const node = new ESPRMNeoNode(nodeConfig("test-node-id"), "test-group-id");
    h.api.respond("PUT", SCHEDULES_ROUTE, legacyUnvalidated({}));

    const result = await node.createSchedule([schedule1, schedule2]);

    const call = h.api.callsTo("PUT", SCHEDULES_ROUTE)[0];
    expect(call.path).toBe("/v1/groups/test-group-id/nodes/test-node-id/schedules");
    expect(call.data).toEqual({ schedules: [schedule1, schedule2] });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: "Morning",
      nodeId: "test-node-id",
      groupId: "test-group-id",
    });
    expect(result[1]).toMatchObject({
      name: "Evening",
      nodeId: "test-node-id",
      groupId: "test-group-id",
    });
  });

  it("should successfully append a schedule to existing schedules when given one item", async () => {
    // `name` required by the spec's schedule request schema.
    const existingSchedule = { id: "existing-1", name: "Existing", enabled: true, triggers: [{ m: 30 }], action: { device1: { param1: "value1" } } };
    const newSchedule = { id: "new-1", name: "New", enabled: false, triggers: [{ m: 60 }], action: { device2: { param2: "value2" } } };

    const node = new ESPRMNeoNode(nodeConfig("test-node-id"), "test-group-id");

    h.api.respond(
      "GET",
      SCHEDULES_ROUTE,
      legacyUnvalidated({ schedules: [existingSchedule] })
    );
    h.api.respond("PUT", SCHEDULES_ROUTE, legacyUnvalidated({}));

    const result = await node.createSchedule(newSchedule);

    expect(h.api.callsTo("GET", SCHEDULES_ROUTE)).toHaveLength(1);
    const putBody = h.api.callsTo("PUT", SCHEDULES_ROUTE)[0].data as {
      schedules: unknown[];
    };
    expect(putBody.schedules).toHaveLength(2);
    expect(putBody.schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining(existingSchedule),
        expect.objectContaining(newSchedule),
      ])
    );
    expect(result).toMatchObject({
      id: "new-1",
      name: "New",
      nodeId: "test-node-id",
      groupId: "test-group-id",
    });
  });
});

describe("ESPRMNeoNode.removeAllSchedules", () => {
  it("should successfully remove all schedules for a node", async () => {
    const node = new ESPRMNeoNode(nodeConfig("test-node-id"), "test-group-id");
    h.api.respond("DELETE", SCHEDULES_ROUTE, legacyUnvalidated({}));

    await node.removeAllSchedules();

    expect(h.api.callsTo("DELETE", SCHEDULES_ROUTE)[0].path).toBe(
      "/v1/groups/test-group-id/nodes/test-node-id/schedules"
    );
  });
});

describe("ESPRMNeoNode.removeSchedule", () => {
  it("should fetch existing schedules and PUT the list without the removed id", async () => {
    const keep = {
      id: "keep-1",
      name: "Keep",
      enabled: true,
      triggers: [{ m: 30 }],
      action: { device1: { param1: "value1" } },
    };
    const remove = {
      id: "remove-1",
      name: "Remove",
      enabled: false,
      triggers: [{ m: 60 }],
      action: { device2: { param2: "value2" } },
    };

    const node = new ESPRMNeoNode(nodeConfig("test-node-id"), "test-group-id");
    h.api.respond(
      "GET",
      SCHEDULES_ROUTE,
      legacyUnvalidated({ schedules: [keep, remove] })
    );
    h.api.respond("PUT", SCHEDULES_ROUTE, legacyUnvalidated({}));

    await node.removeSchedule("remove-1");

    expect(h.api.callsTo("GET", SCHEDULES_ROUTE)).toHaveLength(1);
    expect(h.api.callsTo("PUT", SCHEDULES_ROUTE)[0].data).toEqual({
      schedules: [keep],
    });
  });
});

// ===========================================================================
// ESPRMNeoGroup.getNodes (nested group) — storage/cache heavy
// ===========================================================================
describe("ESPRMNeoGroup.getNodes (nested group)", () => {
  function makeSubgroup(nodeIds?: string[]): ESPRMNeoGroup {
    return new ESPRMNeoGroup({
      groupId: "test-subgroup-id",
      groupName: "Test Subgroup",
      nodeIds,
      parentId: "test-group-id",
    });
  }

  it("should successfully get nodes from storage when fromCloud is false", async () => {
    const subgroup = makeSubgroup(["test-node-id-1", "test-node-id-2"]);

    h.storage.getNodeConfig.mockImplementation(((nodeId: string) => {
      if (nodeId === "test-node-id-1") {
        return Promise.resolve(nodeConfig("test-node-id-1"));
      }
      if (nodeId === "test-node-id-2") {
        return Promise.resolve(nodeConfig("test-node-id-2"));
      }
      return Promise.resolve(null);
    }) as never);

    const result = await subgroup.getNodes({ cache: true });

    expect(h.storage.getNodeConfig).toHaveBeenCalledWith("test-node-id-1");
    expect(h.storage.getNodeConfig).toHaveBeenCalledWith("test-node-id-2");
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(ESPRMNeoNode);
    expect(result[0].nodeId).toBe("test-node-id-1");
    expect(result[0].groupId).toBe("test-group-id");
    expect(result[0].subgroupIds).toEqual(["test-subgroup-id"]);
    expect(result[1].nodeId).toBe("test-node-id-2");
  });

  it("should successfully get nodes from cloud when fromCloud is true", async () => {
    const subgroup = makeSubgroup(["test-node-id-1", "test-node-id-2"]);

    const mockNode1 = new ESPRMNeoNode(nodeConfig("test-node-id-1"), "test-group-id", "test-subgroup-id");
    const mockNode2 = new ESPRMNeoNode(nodeConfig("test-node-id-2"), "test-group-id", "test-subgroup-id");

    subgroup.getNode = jest
      .fn()
      .mockResolvedValueOnce(mockNode1)
      .mockResolvedValueOnce(mockNode2);

    const result = await subgroup.getNodes({ cache: false });

    expect(subgroup.getNode).toHaveBeenCalledWith("test-node-id-1", { cache: false });
    expect(subgroup.getNode).toHaveBeenCalledWith("test-node-id-2", { cache: false });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(mockNode1);
    expect(result[1]).toBe(mockNode2);
  });

  it("should return empty array when nodeIds is undefined", async () => {
    const result = await makeSubgroup(undefined).getNodes();

    expect(result).toEqual([]);
  });

  it("should return empty array when nodeIds is empty", async () => {
    const result = await makeSubgroup([]).getNodes();

    expect(result).toEqual([]);
  });

  it("should skip nodes not found in storage when fromCloud is false", async () => {
    const subgroup = makeSubgroup(["test-node-id-1", "test-node-id-2"]);

    h.storage.getNodeConfig.mockImplementation(((nodeId: string) => {
      if (nodeId === "test-node-id-1") {
        return Promise.resolve(nodeConfig("test-node-id-1"));
      }
      return Promise.resolve(null);
    }) as never);

    const result = await subgroup.getNodes({ cache: true });

    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe("test-node-id-1");
  });
});

// ===========================================================================
// getUserInfo — GET /v1/users/me
// ===========================================================================
describe("getUserInfo", () => {
  const PROFILE = {
    user_id: "81f39dfa-90f1-7008-8db7-1d0191609d71",
    phone_number: "+917058834947",
    email: "test@example.com",
  };

  beforeEach(() => {
    h.userApi.getUserApiWithBearer.mockResolvedValue(PROFILE);
  });

  it("should prefer phone number over email for username and merge profile", async () => {
    const result = await h.user().getUserInfo();

    expect(h.userApi.getUserApiWithBearer).toHaveBeenCalledWith(
      "/v1/users/me",
      expect.any(String)
    );
    expect(result).toHaveProperty("username");
    expect(result).toHaveProperty("userAttributes");
    expect(result.username).toBe("+917058834947");
    expect(result.userId).toBe(PROFILE.user_id);
  });

  it("should use email when phone number is missing", async () => {
    h.userApi.getUserApiWithBearer.mockResolvedValue({
      user_id: "61f3dd5a-50f1-7080-718f-51ba11312280",
      email: "test@example.com",
    });

    const result = await h.user().getUserInfo();

    expect(result.username).toBe("test@example.com");
  });

  it("should fall back to user_id when phone and email are missing", async () => {
    h.userApi.getUserApiWithBearer.mockResolvedValue({
      user_id: "user-id-only",
    });

    const result = await h.user().getUserInfo();

    expect(result.username).toBe("user-id-only");
  });

  it("should throw error when getting user info fails", async () => {
    h.userApi.getUserApiWithBearer.mockRejectedValue(
      new Error("Failed to get user info")
    );

    await expect(h.user().getUserInfo()).rejects.toThrow("Failed to get user info");
  });
});

// ===========================================================================
// listSharingRequests — GET /v1/sharing-requests/received
// ===========================================================================
describe("listSharingRequests", () => {
  const RECEIVED_ROUTE = "/v1/sharing-requests/received";

  it("happy path: maps the payload to ESPRMNeoSharingRequest instances", async () => {
    h.api.respond(
      "GET",
      RECEIVED_ROUTE,
      validated("ListSharingRequestsResponse", {
        sharing_requests: [
          {
            sharing_request_id: "req-1",
            group_id: "grp-1",
            subgroup_id: "",
            access_type: "secondary",
            primary_user_id: "owner-id",
            primary_email: "owner@example.com",
            primary_phone_number: "",
          },
        ],
      })
    );

    const requests = await h.user().listSharingRequests();

    expect(requests).toHaveLength(1);
    expect(requests[0]).toBeInstanceOf(ESPRMNeoSharingRequest);
    expect(requests[0].sharingRequestId).toBe("req-1");
    expect(requests[0].groupId).toBe("grp-1");
    expect(requests[0].accessType).toBe("secondary");
    expect(requests[0].primaryEmail).toBe("owner@example.com");
  });

  it("request contract: GETs /v1/sharing-requests/received", async () => {
    h.api.respond(
      "GET",
      RECEIVED_ROUTE,
      validated("ListSharingRequestsResponse", { sharing_requests: [] })
    );

    await h.user().listSharingRequests();

    expect(h.api.callsTo("GET", RECEIVED_ROUTE)).toHaveLength(1);
  });

  it("edge case: no pending requests resolves to an empty array", async () => {
    h.api.respond(
      "GET",
      RECEIVED_ROUTE,
      validated("ListSharingRequestsResponse", { sharing_requests: [] })
    );

    await expect(h.user().listSharingRequests()).resolves.toEqual([]);
  });

  it("failure mode: a backend error propagates to the caller", async () => {
    h.api.fail("GET", RECEIVED_ROUTE, 403);

    await expect(h.user().listSharingRequests()).rejects.toThrow(
      "HTTP error! status: 403"
    );
  });
});

// ===========================================================================
// assumeRole — POST /v1/assumed-roles
// ===========================================================================
describe("assumeRole", () => {
  const ASSUME_ROUTE = "/v1/assumed-roles";

  it("happy path: returns assume-role credentials", async () => {
    const response = validated("AssumeRoleResponse", {
      access_key: "AKIA-NEW",
      secret_key: "secret-new",
      session_token: "session-new",
    });
    h.api.respond("POST", ASSUME_ROUTE, response);

    const creds = await h.user().assumeRole("AKIA-ID", "secret-id", "session-id");

    expect(creds.access_key).toBe("AKIA-NEW");
    expect(creds.secret_key).toBe("secret-new");
    expect(creds.session_token).toBe("session-new");
  });

  it("request contract: POSTs the identity credentials to /v1/assumed-roles", async () => {
    h.api.respond(
      "POST",
      ASSUME_ROUTE,
      validated("AssumeRoleResponse", { access_key: "a", secret_key: "s", session_token: "t" })
    );

    await h.user().assumeRole("AKIA-ID", "secret-id", "session-id");

    expect(h.api.callsTo("POST", ASSUME_ROUTE)[0].data).toEqual({
      access_key: "AKIA-ID",
      secret_key: "secret-id",
      session_token: "session-id",
    });
  });

  it("request contract: merges optional `include` services into the body", async () => {
    h.api.respond(
      "POST",
      ASSUME_ROUTE,
      validated("AssumeRoleResponse", { access_key: "a", secret_key: "s", session_token: "t" })
    );

    await h.user().assumeRole("AKIA-ID", "secret-id", "session-id", {
      include: ["s3", "kvs"],
    });

    expect(h.api.callsTo("POST", ASSUME_ROUTE)[0].data).toEqual({
      access_key: "AKIA-ID",
      secret_key: "secret-id",
      session_token: "session-id",
      include: ["s3", "kvs"],
    });
  });

  it("failure mode: a response missing credential fields is rejected", async () => {
    // Intentionally invalid — tests the SDK's own guard, not the schema.
    // Double-cast required because TypeScript correctly blocks direct casts
    // to branded types; `as unknown` is the explicit bypass signal.
    h.api.respond(
      "POST",
      ASSUME_ROUTE,
      { access_key: "a", secret_key: "s" } as unknown as InvalidResponse
    );

    await expect(
      h.user().assumeRole("AKIA-ID", "secret-id", "session-id")
    ).rejects.toThrow(/missing required credential fields/i);
  });
});

// ===========================================================================
// getTemporaryAWSCredentials — POST /v1/user/credentials (raw fetch, Bearer)
// ===========================================================================
describe("getTemporaryAWSCredentials", () => {
  const realFetch = global.fetch;

  function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  beforeEach(() => {
    h.storage.getItem.mockResolvedValue("id-token" as never);
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it("happy path: maps the snake_case payload to camelCase credentials", async () => {
    mockFetchOnce(
      validated("UserCredsResponse", {
        access_key_id: "AKIA-TEMP",
        secret_access_key: "secret-temp",
        session_token: "session-temp",
        expiration: 1893456000,
        message: "Success",
      })
    );

    const creds = await h.user().getTemporaryAWSCredentials();

    expect(creds.accessKey).toBe("AKIA-TEMP");
    expect(creds.secretKey).toBe("secret-temp");
    expect(creds.sessionToken).toBe("session-temp");
    expect(creds.expiration).toBe(new Date(1893456000 * 1000).toISOString());
    expect(creds.message).toBe("Success");
    expect(h.storage.saveTemporaryCredentials).toHaveBeenCalled();
  });

  it("request contract: POSTs /v1/user/credentials with a Bearer ID token", async () => {
    mockFetchOnce(
      validated("UserCredsResponse", {
        access_key_id: "AKIA-TEMP",
        secret_access_key: "s",
        session_token: "t",
        expiration: 1893456000,
      })
    );

    await h.user().getTemporaryAWSCredentials();

    const fetchMock = global.fetch as unknown as jest.Mock;
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v1/user/credentials");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer id-token");
  });

  it("should throw error when SDK is not initialized", async () => {
    const user = h.user(); // construct while config is still healthy
    jest.spyOn(ESPRMNeoBase, "getConfig").mockImplementation(() => {
      throw new Error("SDK not initialized");
    });

    await expect(user.getTemporaryAWSCredentials()).rejects.toThrow(
      "SDK not initialized"
    );
  });

  it("should throw error when ID token is missing from storage", async () => {
    h.storage.getItem.mockResolvedValue(null as never);
    const fetchSpy = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchSpy;

    await expect(h.user().getTemporaryAWSCredentials()).rejects.toThrow(
      /Missing ID token/i
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("failure mode: an incomplete credentials payload is rejected", async () => {
    // Missing session_token — tests SDK's extractCredentials() guard.
    mockFetchOnce({ access_key_id: "a", secret_access_key: "s" });

    await expect(h.user().getTemporaryAWSCredentials()).rejects.toThrow(
      /Incomplete AWS credentials/i
    );
  });

  it("failure mode: a 500 from the credentials endpoint is rejected", async () => {
    mockFetchOnce({ message: "Server error" }, { ok: false, status: 500 });

    await expect(h.user().getTemporaryAWSCredentials()).rejects.toThrow();
  });
});
