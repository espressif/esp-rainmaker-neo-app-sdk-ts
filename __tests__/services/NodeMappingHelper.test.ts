/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for `NodeMappingHelper` — the HTTP boundary of the node
 * association (claiming) flow used by `ESPDevice.provision()`.
 *
 * `POST .../node-assoc-requests/{requestId}/verify` is a tracked
 * request contract, so the harness auto-validates the verify bodies.
 * The sibling `/confirm` operation is also tracked but the SDK never calls
 * it (the Matter NOC flow is unimplemented) — flag when that flow lands.
 *
 * (Replaces the old "should have method" typeof padding.)
 */

import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { NodeMappingHelper } from "../../src/services/ESPRMNeoHelpers/NodeMappingHelper";

const h = setupSdkTest();

const GROUP_ID = "grp-claim";
const REQUEST_ID = "assoc-req-001";
const INITIATE_ROUTE = "/v1/groups/:gid/node-assoc-requests";
const VERIFY_ROUTE = "/v1/groups/:gid/node-assoc-requests/:rid/verify";

describe("NodeMappingHelper.initiateUserNodeMapping", () => {
  it("POSTs the mapping request and returns the raw response", async () => {
    // Response schema not in the exported bundle yet (tracked gap).
    h.api.respond("POST", INITIATE_ROUTE, {
      request_id: REQUEST_ID,
      challenge: "hex-challenge",
    });

    const response = await NodeMappingHelper.initiateUserNodeMapping(GROUP_ID);

    const [call] = h.api.callsTo("POST", INITIATE_ROUTE);
    expect(call.path).toBe(`/v1/groups/${GROUP_ID}/node-assoc-requests`);
    expect(call.data).toEqual({});
    expect(response).toEqual({
      request_id: REQUEST_ID,
      challenge: "hex-challenge",
    });
  });
});

describe("NodeMappingHelper.verifyUserNodeMapping", () => {
  it("request contract: POSTs the challenge-response body (auto-validated)", async () => {
    h.api.respond("POST", VERIFY_ROUTE, {});

    const result = await NodeMappingHelper.verifyUserNodeMapping(
      GROUP_ID,
      REQUEST_ID,
      { challenge_response: "signed-challenge-hex", node_id: "node-claimed" }
    );

    const [call] = h.api.callsTo("POST", VERIFY_ROUTE);
    expect(call.path).toBe(
      `/v1/groups/${GROUP_ID}/node-assoc-requests/${REQUEST_ID}/verify`
    );
    expect(call.data).toEqual({
      challenge_response: "signed-challenge-hex",
      node_id: "node-claimed",
    });
    expect(result).toEqual({
      message: "User node mapping verified successfully",
    });
  });

  it("request contract: the Matter attestation body also satisfies the spec", async () => {
    h.api.respond("POST", VERIFY_ROUTE, {});

    await NodeMappingHelper.verifyUserNodeMapping(GROUP_ID, REQUEST_ID, {
      nocsr_elements: "hex-tlv",
      attestation_challenge: "hex-challenge",
      attestation_signature: "hex-signature",
    });

    const [call] = h.api.callsTo("POST", VERIFY_ROUTE);
    expect(call.data).toEqual({
      nocsr_elements: "hex-tlv",
      attestation_challenge: "hex-challenge",
      attestation_signature: "hex-signature",
    });
  });

  it("passes through a backend-provided message", async () => {
    h.api.respond("POST", VERIFY_ROUTE, { message: "Node added to group" });

    const result = await NodeMappingHelper.verifyUserNodeMapping(
      GROUP_ID,
      REQUEST_ID,
      { challenge_response: "sig", node_id: "node-1" }
    );

    expect(result).toEqual({ message: "Node added to group" });
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("POST", VERIFY_ROUTE, 401);

    await expect(
      NodeMappingHelper.verifyUserNodeMapping(GROUP_ID, REQUEST_ID, {
        challenge_response: "sig",
        node_id: "node-1",
      })
    ).rejects.toThrow("HTTP error! status: 401");
  });
});
