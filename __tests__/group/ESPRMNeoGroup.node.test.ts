/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for ESPRMNeoGroup node-access methods:
 *   getNode, getNodes
 *
 * getNode fetches a node's configuration from the cloud (or local cache),
 * wraps it in an ESPRMNeoNode, and stores the result.  getNodes fans out
 * to getNode for every nodeId in the group with concurrency limiting.
 *
 * ★ Runs on the shared SDK test harness: `h.storage` covers the config
 * cache, `h.api` the cloud fetch.
 */

import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoGroup } from "../../src/ESPRMNeoGroup";
import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import type { NodeConfigAPI } from "../../src/types/output";

const h = setupSdkTest();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GROUP_ID  = "grp-home";
const CHILD_ID  = "sub-living";
const NODE_ID   = "node-light-01";

const CONFIG_ROUTE = "/v1/groups/:gid/nodes/:nid/config";

function makeRootGroup(nodeIds = [NODE_ID]): ESPRMNeoGroup {
  return new ESPRMNeoGroup({ groupId: GROUP_ID, groupName: "Home", accessType: "primary", nodeIds });
}

function makeChildGroup(nodeIds = [NODE_ID]): ESPRMNeoGroup {
  return new ESPRMNeoGroup({ groupId: CHILD_ID, groupName: "Living Room", parentId: GROUP_ID, nodeIds });
}

// id-keyed devices — the shape the backend serializes and ESPRMNeoDeviceAPI
// requires. Not wrapped in validated("NodeConfig"): the OpenAPI schema still
// documents `name` instead of `id` and would reject the real shape.
// Fresh object each call so the SDK's `config.node_id = nodeId` mutation
// does not bleed across tests.
function mockNodeConfig(): NodeConfigAPI {
  return {
    info: { fw_version: "1.0.0", name: "Light Switch" },
    devices: [
      {
        id: "Light",
        type: "esp.device.lightbulb",
        primary: "Power",
        params: [],
        attributes: [],
      },
    ],
    services: [],
  };
}

// ===========================================================================
// getNode()
// ===========================================================================
describe("ESPRMNeoGroup.getNode", () => {
  it("happy path: fetches from cloud, caches result, returns ESPRMNeoNode", async () => {
    h.api.on("GET", CONFIG_ROUTE, () => mockNodeConfig());

    const node = await makeRootGroup().getNode(NODE_ID);

    expect(node).toBeInstanceOf(ESPRMNeoNode);
    expect(node.nodeId).toBe(NODE_ID);
    // Result is persisted to storage
    expect(h.storage.setNodeConfig).toHaveBeenCalledWith(
      NODE_ID,
      expect.any(Object)
    );
  });

  it("request contract (root group): GETs the group node-config path", async () => {
    h.api.on("GET", CONFIG_ROUTE, () => mockNodeConfig());

    await makeRootGroup().getNode(NODE_ID);

    expect(h.api.callsTo("GET", CONFIG_ROUTE)[0].path).toBe(
      `/v1/groups/${GROUP_ID}/nodes/${NODE_ID}/config`
    );
  });

  it("request contract (child group): GETs the ROOT-group node-config path", async () => {
    // The subgroup config variant does not exist in the backend — child
    // groups resolve config through the root-group route (parentId).
    h.api.on("GET", CONFIG_ROUTE, () => mockNodeConfig());

    await makeChildGroup().getNode(NODE_ID);

    expect(h.api.callsTo("GET", CONFIG_ROUTE)[0].path).toBe(
      `/v1/groups/${GROUP_ID}/nodes/${NODE_ID}/config`
    );
  });

  it("cache hit: returns cached node without making an API call", async () => {
    // Pre-populate cache
    h.storage.getNodeConfig.mockResolvedValue({
      ...mockNodeConfig(),
      node_id: NODE_ID,
    });

    const node = await makeRootGroup().getNode(NODE_ID);

    expect(node).toBeInstanceOf(ESPRMNeoNode);
    expect(h.api.calls).toHaveLength(0);
  });

  it("fromCloud=true bypasses cache and refreshes storage", async () => {
    // Cache is populated but cache:false forces a fresh fetch
    h.storage.getNodeConfig.mockResolvedValue({
      ...mockNodeConfig(),
      node_id: NODE_ID,
    });
    h.api.on("GET", CONFIG_ROUTE, () => mockNodeConfig());

    const node = await makeRootGroup().getNode(NODE_ID, { cache: false });

    expect(node).toBeInstanceOf(ESPRMNeoNode);
    expect(h.api.callsTo("GET", CONFIG_ROUTE)).toHaveLength(1); // fetched despite cache
    expect(h.storage.setNodeConfig).toHaveBeenCalled();         // cache refreshed
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("GET", CONFIG_ROUTE, 404);

    await expect(makeRootGroup().getNode(NODE_ID)).rejects.toThrow(
      "HTTP error! status: 404"
    );
  });
});

// ===========================================================================
// getNodes()
// ===========================================================================
describe("ESPRMNeoGroup.getNodes", () => {
  it("happy path: returns ESPRMNeoNode instances for all nodeIds", async () => {
    h.api.on("GET", CONFIG_ROUTE, () => mockNodeConfig());

    const nodes = await makeRootGroup(["node-a", "node-b"]).getNodes();

    expect(nodes).toHaveLength(2);
    nodes.forEach((n) => expect(n).toBeInstanceOf(ESPRMNeoNode));
    expect(h.api.callsTo("GET", CONFIG_ROUTE)).toHaveLength(2);
  });

  it("edge case: empty nodeIds list returns an empty array without any API calls", async () => {
    const nodes = await makeRootGroup([]).getNodes();

    expect(nodes).toEqual([]);
    expect(h.api.calls).toHaveLength(0);
  });

  it("failure resilience: failed individual nodes are filtered out", async () => {
    // node-ok succeeds; node-fail's config fetch 500s — getNodes drops it.
    h.api.on("GET", CONFIG_ROUTE, ({ params }) => {
      if (params.nid === "node-fail") {
        throw new Error("HTTP error! status: 500");
      }
      return mockNodeConfig();
    });

    const nodes = await makeRootGroup(["node-ok", "node-fail"]).getNodes();

    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeId).toBe("node-ok");
  });

  it("subgroup: fans out to the ROOT-group config path", async () => {
    h.api.on("GET", CONFIG_ROUTE, () => mockNodeConfig());

    const nodes = await makeChildGroup(["node-a"]).getNodes();

    expect(nodes).toHaveLength(1);
    const [call] = h.api.callsTo("GET", CONFIG_ROUTE);
    expect(call.path).toBe(`/v1/groups/${GROUP_ID}/nodes/node-a/config`);
  });
});
