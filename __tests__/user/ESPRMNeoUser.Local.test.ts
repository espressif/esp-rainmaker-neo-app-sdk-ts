/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cross-module flow: getGroups → group.getNodes({ cache: true }) resolves node
 * configs from local storage without hitting the config API.
 *
 * ★ Runs on the shared SDK test harness. The old file's "ESPRMNeoStorage node
 * config" describe was dropped: both tests only asserted that a mocked
 * function returned what it was mocked with — tautologies that verified the
 * mock, not the SDK.
 */

import { validated } from "../../test-utils/response-builder";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";

const h = setupSdkTest();

describe("ESPRMNeoUser Local / Group nodes", () => {
  it("should get nodes via getGroups and group.getNodes({ cache: true })", async () => {
    const config = (id: string) => ({
      node_id: id,
      devices: [],
      services: [],
    });

    h.api.respond(
      "GET",
      "/v1/groups",
      validated("ListGroupsResponse", {
        groups: [
          {
            group_id: "test-group",
            group_name: "Test",
            node_ids: ["node-1", "node-2"],
            subgroups: [],
          },
        ],
      })
    );

    h.storage.getNodeConfig.mockImplementation(((nodeId: string) => {
      if (nodeId === "node-1") {
        return Promise.resolve(config("node-1"));
      }
      if (nodeId === "node-2") {
        return Promise.resolve(config("node-2"));
      }
      return Promise.resolve(null);
    }) as never);

    const groups = await h.user().getGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].groupId).toBe("test-group");

    const nodes = await groups[0].getNodes({ cache: true });
    expect(nodes).toHaveLength(2);
    // local resolution only — no node-config API calls were made
    expect(h.api.callsTo("GET", "/v1/groups/:gid/nodes/:nid/config")).toHaveLength(0);
  });
});
