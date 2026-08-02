/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for `ESPRMNeoGroup` instance methods.
 *
 * ★ Runs on the shared SDK test harness: `setupSdkTest()` wires the whole
 * boundary; responses are routes on `h.api` (request bodies auto-validated
 *), faults use `h.api.fail(...)`, and request-construction
 * assertions read the harness call log via `callsTo()`.
 *
 * # Layout per method
 *
 *   describe("ESPRMNeoGroup.<method>")
 *     ├─ "happy path"       → response mapping is correct
 *     ├─ "request contract" → correct HTTP verb + path + body
 *     ├─ "edge cases"       → child-group paths, optional args, local state
 *     └─ "failure modes"    → guards throw before HTTP, errors propagate
 */

import { validated } from "../../test-utils/response-builder";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoGroup } from "../../src/ESPRMNeoGroup";

const h = setupSdkTest();

// ---------------------------------------------------------------------------
// Route templates (root vs subgroup variants of each endpoint)
// ---------------------------------------------------------------------------

const R = {
  share: "/v1/groups/:gid/sharing-requests",
  shareSub: "/v1/groups/:gid/subgroups/:sid/sharing-requests",
  users: "/v1/groups/:gid/users",
  member: "/v1/groups/:gid/users/:uid",
  memberSub: "/v1/groups/:gid/subgroups/:sid/users/:uid",
  group: "/v1/groups/:gid",
  subgroup: "/v1/groups/:gid/subgroups/:sid",
  subgroups: "/v1/groups/:gid/subgroups",
  node: "/v1/groups/:gid/nodes/:nid",
  nodeSub: "/v1/groups/:gid/subgroups/:sid/nodes/:nid",
};

// ---------------------------------------------------------------------------
// Test fixtures (re-used instances)
// ---------------------------------------------------------------------------

const ROOT_GROUP_ID  = "grp-home";
const ROOT_GROUP_NAME = "Home";
const CHILD_GROUP_ID  = "sub-living-room";
const CHILD_GROUP_NAME = "Living Room";
const NODE_ID  = "node-light-01";
const USER_ID  = "user-guest-id";

function makeRootGroup(
  overrides: Partial<ConstructorParameters<typeof ESPRMNeoGroup>[0]> = {}
): ESPRMNeoGroup {
  return new ESPRMNeoGroup({
    groupId: ROOT_GROUP_ID,
    groupName: ROOT_GROUP_NAME,
    accessType: "primary",
    nodeIds: [NODE_ID],
    ...overrides,
  });
}

function makeChildGroup(
  overrides: Partial<ConstructorParameters<typeof ESPRMNeoGroup>[0]> = {}
): ESPRMNeoGroup {
  return new ESPRMNeoGroup({
    groupId: CHILD_GROUP_ID,
    groupName: CHILD_GROUP_NAME,
    parentId: ROOT_GROUP_ID,
    nodeIds: [NODE_ID],
    ...overrides,
  });
}

/** The single call matching a template — asserts exactly one was made. */
function theCallTo(method: string, template: string) {
  const calls = h.api.callsTo(method, template);
  expect(calls).toHaveLength(1);
  return calls[0];
}

// ===========================================================================
// share()
// ===========================================================================
describe("ESPRMNeoGroup.share", () => {
  let root: ESPRMNeoGroup;
  let child: ESPRMNeoGroup;

  beforeEach(() => {
    root  = makeRootGroup();
    child = makeChildGroup();
  });

  it("happy path: resolves with the API response (contract-validated)", async () => {
    h.api.respond(
      "POST",
      R.share,
      validated("CreateSharingRequestResponse", {
        request_id: "9f1a3b52-7c4d-4e8f-a1b2-3c4d5e6f7a8b",
        message: "Invitation sent",
      })
    );

    const result = await root.share({ username: "user@example.com", accessType: "secondary" });

    expect(result).toBeDefined();
  });

  it("request contract (root group): POSTs /v1/groups/{groupId}/sharing-requests", async () => {
    h.api.respond(
      "POST",
      R.share,
      validated("CreateSharingRequestResponse", {
        request_id: "9f1a3b52-7c4d-4e8f-a1b2-3c4d5e6f7a8b",
        message: "ok",
      })
    );

    await root.share({ username: "user@example.com", accessType: "secondary" });

    const call = theCallTo("POST", R.share);
    expect(call.path).toBe(`/v1/groups/${ROOT_GROUP_ID}/sharing-requests`);
    expect(call.data).toEqual({ username: "user@example.com", access_type: "secondary" });
    // body shape vs spec is auto-checked by the harness
  });

  it("request contract (child group): POSTs to the subgroup sharing-requests path", async () => {
    h.api.respond(
      "POST",
      R.shareSub,
      validated("CreateSharingRequestResponse", {
        request_id: "9f1a3b52-7c4d-4e8f-a1b2-3c4d5e6f7a8b",
        message: "ok",
      })
    );

    await child.share({ username: "+919876543210", accessType: "secondary" });

    const call = theCallTo("POST", R.shareSub);
    expect(call.path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/subgroups/${CHILD_GROUP_ID}/sharing-requests`
    );
    expect(call.data).toEqual({ username: "+919876543210", access_type: "secondary" });
  });

  it("failure mode: missing username throws before any HTTP call", async () => {
    await expect(root.share({ accessType: "secondary" } as never)).rejects.toThrow(
      /username/i
    );

    expect(h.api.calls).toHaveLength(0);
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("POST", R.share, 400);

    await expect(
      root.share({ username: "user@example.com", accessType: "secondary" })
    ).rejects.toThrow("HTTP error! status: 400");
  });
});

// ===========================================================================
// getSharingInfo()
// ===========================================================================
describe("ESPRMNeoGroup.getSharingInfo", () => {
  let root: ESPRMNeoGroup;
  let child: ESPRMNeoGroup;

  beforeEach(() => {
    root  = makeRootGroup();
    child = makeChildGroup();
  });

  it("happy path: returns the users array from the response", async () => {
    h.api.respond(
      "GET",
      R.users,
      validated("ListGroupUsersResponse", {
        users: [
          { user_id: "owner", email: "owner@example.com", access_type: "primary" },
          { user_id: USER_ID, email: "guest@example.com", access_type: "secondary" },
        ],
      })
    );

    const result = await root.getSharingInfo();

    expect(result.users).toHaveLength(2);
    expect(result.users[1].userId).toBe(USER_ID);
    expect(result.users[1].accessType).toBe("secondary");
  });

  it("request contract: GETs /v1/groups/{groupId}/users", async () => {
    h.api.respond("GET", R.users, validated("ListGroupUsersResponse", { users: [] }));

    await root.getSharingInfo();

    const call = theCallTo("GET", R.users);
    expect(call.path).toBe(`/v1/groups/${ROOT_GROUP_ID}/users`);
  });

  it("edge case: empty users list is returned as-is", async () => {
    h.api.respond("GET", R.users, validated("ListGroupUsersResponse", { users: [] }));

    const result = await root.getSharingInfo();

    expect(result.users).toEqual([]);
  });

  it("nested subgroup: GETs /v1/groups/{parentId}/subgroups/{subgroupId}/users", async () => {
    h.api.respond(
      "GET",
      "/v1/groups/:groupId/subgroups/:subgroupId/users",
      validated("ListGroupUsersResponse", {
        users: [
          { user_id: "owner", email: "owner@example.com", access_type: "primary" },
        ],
      })
    );

    const result = await child.getSharingInfo();

    const call = theCallTo(
      "GET",
      "/v1/groups/:groupId/subgroups/:subgroupId/users"
    );
    expect(call.path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/subgroups/${CHILD_GROUP_ID}/users`
    );
    expect(result.users).toHaveLength(1);
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("GET", R.users, 403);

    await expect(root.getSharingInfo()).rejects.toThrow("HTTP error! status: 403");
  });
});

// ===========================================================================
// removeMember()
// ===========================================================================
describe("ESPRMNeoGroup.removeMember", () => {
  let root: ESPRMNeoGroup;
  let child: ESPRMNeoGroup;

  beforeEach(() => {
    root  = makeRootGroup();
    child = makeChildGroup();
  });

  it("happy path: returns a normalized success response", async () => {
    h.api.respond(
      "DELETE",
      R.member,
      validated("APIStatusMessage", { message: "Member removed successfully" })
    );

    const result = await root.removeMember(USER_ID);

    expect(result.message).toBeTruthy();
  });

  it("request contract (root group): DELETEs /v1/groups/{groupId}/users/{userId}", async () => {
    h.api.respond("DELETE", R.member, validated("APIStatusMessage", { message: "ok" }));

    await root.removeMember(USER_ID);

    expect(theCallTo("DELETE", R.member).path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/users/${USER_ID}`
    );
  });

  it("request contract (child group): DELETEs the subgroup user path", async () => {
    h.api.respond("DELETE", R.memberSub, validated("APIStatusMessage", { message: "ok" }));

    await child.removeMember(USER_ID);

    expect(theCallTo("DELETE", R.memberSub).path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/subgroups/${CHILD_GROUP_ID}/users/${USER_ID}`
    );
  });

  it("failure mode: blank userId throws before any HTTP call", async () => {
    await expect(root.removeMember("   ")).rejects.toThrow(/user\s*id/i);

    expect(h.api.calls).toHaveLength(0);
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("DELETE", R.member, 403);

    await expect(root.removeMember(USER_ID)).rejects.toThrow("HTTP error! status: 403");
  });
});

// ===========================================================================
// leave()
// ===========================================================================
describe("ESPRMNeoGroup.leave", () => {
  it("happy path: delegates to removeMember with 'me'", async () => {
    const root = makeRootGroup();
    h.api.respond("DELETE", R.member, validated("APIStatusMessage", { message: "Left group" }));

    const result = await root.leave();

    expect(result.message).toBeTruthy();
    expect(theCallTo("DELETE", R.member).path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/users/me`
    );
  });

  it("request contract (child group): uses subgroup user path with 'me'", async () => {
    const child = makeChildGroup();
    h.api.respond("DELETE", R.memberSub, validated("APIStatusMessage", { message: "ok" }));

    await child.leave();

    expect(theCallTo("DELETE", R.memberSub).path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/subgroups/${CHILD_GROUP_ID}/users/me`
    );
  });
});

// ===========================================================================
// delete()
// ===========================================================================
describe("ESPRMNeoGroup.delete", () => {
  it("happy path: returns a normalized success response", async () => {
    const root = makeRootGroup();
    h.api.respond(
      "DELETE",
      R.group,
      validated("APIStatusMessage", { message: "Group deleted successfully" })
    );

    const result = await root.delete();

    expect(result.message).toBeTruthy();
  });

  it("request contract (root group): DELETEs /v1/groups/{groupId}", async () => {
    const root = makeRootGroup();
    h.api.respond("DELETE", R.group, validated("APIStatusMessage", { message: "ok" }));

    await root.delete();

    expect(theCallTo("DELETE", R.group).path).toBe(`/v1/groups/${ROOT_GROUP_ID}`);
  });

  it("request contract (child group): DELETEs the subgroup path", async () => {
    const child = makeChildGroup();
    h.api.respond("DELETE", R.subgroup, validated("APIStatusMessage", { message: "ok" }));

    await child.delete();

    expect(theCallTo("DELETE", R.subgroup).path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/subgroups/${CHILD_GROUP_ID}`
    );
  });

  it("failure mode: API error propagates to the caller", async () => {
    const root = makeRootGroup();
    h.api.fail("DELETE", R.group, 403);

    await expect(root.delete()).rejects.toThrow("HTTP error! status: 403");
  });
});

// ===========================================================================
// updateName()
// ===========================================================================
describe("ESPRMNeoGroup.updateName", () => {
  it("happy path: updates groupName on the instance after the API call", async () => {
    const root = makeRootGroup();
    h.api.respond("PATCH", R.group, validated("APIStatusMessage", { message: "Name updated" }));

    await root.updateName("New Name");

    expect(root.groupName).toBe("New Name");
  });

  it("request contract (root group): PATCHes /v1/groups/{groupId} with group_name", async () => {
    const root = makeRootGroup();
    h.api.respond("PATCH", R.group, validated("APIStatusMessage", { message: "ok" }));

    await root.updateName("Garage");

    const call = theCallTo("PATCH", R.group);
    expect(call.path).toBe(`/v1/groups/${ROOT_GROUP_ID}`);
    expect(call.data).toEqual({ group_name: "Garage" });
  });

  it("request contract (child group): PATCHes the subgroup path with subgroup_name", async () => {
    const child = makeChildGroup();
    h.api.respond("PATCH", R.subgroup, validated("APIStatusMessage", { message: "ok" }));

    await child.updateName("Bedroom");

    const call = theCallTo("PATCH", R.subgroup);
    expect(call.path).toBe(`/v1/groups/${ROOT_GROUP_ID}/subgroups/${CHILD_GROUP_ID}`);
    expect(call.data).toEqual({ subgroup_name: "Bedroom" });
  });

  it("failure mode: groupName is NOT updated when the API call fails", async () => {
    const root = makeRootGroup();
    h.api.fail("PATCH", R.group, 400);

    await expect(root.updateName("Broken Name")).rejects.toThrow(
      "HTTP error! status: 400"
    );

    expect(root.groupName).toBe(ROOT_GROUP_NAME);
  });
});

// ===========================================================================
// addNode()
// ===========================================================================
describe("ESPRMNeoGroup.addNode", () => {
  const NEW_NODE = "node-sensor-02";

  it("happy path: node is added to the local nodeIds list", async () => {
    const child = makeChildGroup({ nodeIds: [] });
    h.api.respond("PUT", R.nodeSub, validated("APIStatusMessage", { message: "Node added" }));

    await child.addNode(NEW_NODE);

    expect(child.nodeIds).toContain(NEW_NODE);
  });

  it("request contract: PUTs /v1/groups/{parentId}/subgroups/{subgroupId}/nodes/{nodeId}", async () => {
    const child = makeChildGroup({ nodeIds: [] });
    h.api.respond("PUT", R.nodeSub, validated("APIStatusMessage", { message: "ok" }));

    await child.addNode(NEW_NODE);

    expect(theCallTo("PUT", R.nodeSub).path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/subgroups/${CHILD_GROUP_ID}/nodes/${NEW_NODE}`
    );
  });

  it("failure mode: root group throws — addNode is subgroup-only", async () => {
    const root = makeRootGroup();

    await expect(root.addNode(NEW_NODE)).rejects.toThrow(/only supported on nested groups/i);

    expect(h.api.calls).toHaveLength(0);
  });

  it("failure mode: adding a duplicate node throws before any HTTP call", async () => {
    const child = makeChildGroup();

    await expect(child.addNode(NODE_ID)).rejects.toThrow(/already in this group/i);

    expect(h.api.calls).toHaveLength(0);
  });

  it("failure mode: API error propagates and nodeIds is unchanged", async () => {
    const child = makeChildGroup({ nodeIds: [] });
    h.api.fail("PUT", R.nodeSub, 400);

    await expect(child.addNode(NEW_NODE)).rejects.toThrow("HTTP error! status: 400");

    expect(child.nodeIds).not.toContain(NEW_NODE);
  });
});

// ===========================================================================
// removeNode()
// ===========================================================================
describe("ESPRMNeoGroup.removeNode", () => {
  it("happy path (root group): node is removed from local nodeIds", async () => {
    const root = makeRootGroup({ nodeIds: [NODE_ID, "other-node"] });
    h.api.respond("DELETE", R.node, validated("APIStatusMessage", { message: "Node removed" }));

    await root.removeNode(NODE_ID);

    expect(root.nodeIds).not.toContain(NODE_ID);
    expect(root.nodeIds).toContain("other-node");
  });

  it("happy path (child group): node is removed from local nodeIds", async () => {
    const child = makeChildGroup({ nodeIds: [NODE_ID] });
    h.api.respond("DELETE", R.nodeSub, validated("APIStatusMessage", { message: "ok" }));

    await child.removeNode(NODE_ID);

    expect(child.nodeIds).not.toContain(NODE_ID);
  });

  it("request contract (root group): DELETEs /v1/groups/{groupId}/nodes/{nodeId}", async () => {
    const root = makeRootGroup();
    h.api.respond("DELETE", R.node, validated("APIStatusMessage", { message: "ok" }));

    await root.removeNode(NODE_ID);

    expect(theCallTo("DELETE", R.node).path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/nodes/${NODE_ID}`
    );
  });

  it("request contract (child group): DELETEs the subgroup node path", async () => {
    const child = makeChildGroup();
    h.api.respond("DELETE", R.nodeSub, validated("APIStatusMessage", { message: "ok" }));

    await child.removeNode(NODE_ID);

    expect(theCallTo("DELETE", R.nodeSub).path).toBe(
      `/v1/groups/${ROOT_GROUP_ID}/subgroups/${CHILD_GROUP_ID}/nodes/${NODE_ID}`
    );
  });

  it("failure mode: API error propagates and nodeIds is unchanged", async () => {
    const root = makeRootGroup({ nodeIds: [NODE_ID] });
    h.api.fail("DELETE", R.node, 403);

    await expect(root.removeNode(NODE_ID)).rejects.toThrow("HTTP error! status: 403");

    expect(root.nodeIds).toContain(NODE_ID);
  });
});

// ===========================================================================
// createSubGroup()
// ===========================================================================
describe("ESPRMNeoGroup.createSubGroup", () => {
  it("happy path: returns an ESPRMNeoGroup instance with parentId set", async () => {
    const root = makeRootGroup();
    h.api.respond(
      "POST",
      R.subgroups,
      validated("CreateSubgroupResponse", { subgroup_id: "sub-new-123" })
    );

    const child = await root.createSubGroup("Kitchen");

    expect(child).toBeInstanceOf(ESPRMNeoGroup);
    expect(child.groupId).toBe("sub-new-123");
    expect(child.groupName).toBe("Kitchen");
    expect(child.parentId).toBe(ROOT_GROUP_ID);
    expect(child.nodeIds).toEqual([]);
  });

  it("request contract: POSTs /v1/groups/{groupId}/subgroups with subgroup_name", async () => {
    const root = makeRootGroup();
    h.api.respond(
      "POST",
      R.subgroups,
      validated("CreateSubgroupResponse", { subgroup_id: "sub-x" })
    );

    await root.createSubGroup("Garage");

    const call = theCallTo("POST", R.subgroups);
    expect(call.path).toBe(`/v1/groups/${ROOT_GROUP_ID}/subgroups`);
    expect(call.data).toEqual({ subgroup_name: "Garage" });
  });

  it("edge case: new subgroup is appended to the parent's subgroups list", async () => {
    const root = makeRootGroup({ subgroups: [] });
    h.api.respond(
      "POST",
      R.subgroups,
      validated("CreateSubgroupResponse", { subgroup_id: "sub-y" })
    );

    const child = await root.createSubGroup("Balcony");

    expect(root.subgroups).toHaveLength(1);
    expect(root.subgroups![0]).toBe(child);
  });

  it("failure mode: API error propagates to the caller", async () => {
    const root = makeRootGroup();
    h.api.fail("POST", R.subgroups, 400);

    await expect(root.createSubGroup("Balcony")).rejects.toThrow(
      "HTTP error! status: 400"
    );
  });
});
