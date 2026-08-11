/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

jest.mock("../../src/services/NodeMQTTOrchestrator", () => ({
  NodeMQTTOrchestrator: {
    registerNode: jest.fn(),
    unregisterNode: jest.fn(),
    isNodeRegistered: jest.fn(),
    subscribeToNode: jest.fn(),
    unsubscribeFromNode: jest.fn(),
    getShadow: jest.fn(),
  },
}));

jest.mock("../../src/services/ESPRMNeoMqtt/ESPRMNeoMqtt", () => ({
  ESPRMNeoMqtt: {
    hasInstance: jest.fn(),
    getInstance: jest.fn(),
  },
}));

import { NodeMQTTOrchestrator } from "../../src/services/NodeMQTTOrchestrator";
import { ESPRMNeoMqtt } from "../../src/services/ESPRMNeoMqtt/ESPRMNeoMqtt";
import {
  waitForNodeOnline,
  isNodeOnlineFromShadowPayload,
} from "../../src/utils/waitForNodeOnline";
import { ESPProvError } from "../../src/utils/error/ESPProvError";
import { ProvErrorCodes } from "../../src/utils/constants";
import type { ESPRMNeoUser } from "../../src/ESPRMNeoUser";

const registerNode = NodeMQTTOrchestrator.registerNode as jest.Mock;
const unregisterNode = NodeMQTTOrchestrator.unregisterNode as jest.Mock;
const isNodeRegistered = NodeMQTTOrchestrator.isNodeRegistered as jest.Mock;
const subscribeToNode = NodeMQTTOrchestrator.subscribeToNode as jest.Mock;
const unsubscribeFromNode = NodeMQTTOrchestrator.unsubscribeFromNode as jest.Mock;
const getShadow = NodeMQTTOrchestrator.getShadow as jest.Mock;
const hasInstance = ESPRMNeoMqtt.hasInstance as jest.Mock;
const getInstance = ESPRMNeoMqtt.getInstance as jest.Mock;

const NODE_ID = "n1";
const GROUP_ID = "g1";

describe("waitForNodeOnline", () => {
  let user: ESPRMNeoUser;

  beforeEach(() => {
    // Default happy path: MQTT already connected, node not yet registered,
    // shadow reports online on the first GET poll.
    hasInstance.mockReturnValue(true);
    getInstance.mockReturnValue({
      isConnected: jest.fn().mockResolvedValue(true),
    });
    isNodeRegistered.mockReturnValue(false);
    subscribeToNode.mockResolvedValue(undefined);
    unsubscribeFromNode.mockResolvedValue(undefined);
    getShadow.mockResolvedValue({ reported: { online: true } });
    user = {
      connectMQTT: jest.fn().mockResolvedValue(undefined),
    } as unknown as ESPRMNeoUser;
  });

  it("binds to the home-only shadow when subgroupIds is omitted (legacy callers)", async () => {
    await waitForNodeOnline({ nodeId: NODE_ID, groupId: GROUP_ID, user });

    expect(registerNode).toHaveBeenCalledWith(NODE_ID, `params-${GROUP_ID}`);
    expect(user.connectMQTT).not.toHaveBeenCalled();
  });

  it("binds to the sorted subgroup membership shadow when subgroupIds is provided", async () => {
    await waitForNodeOnline({
      nodeId: NODE_ID,
      groupId: GROUP_ID,
      subgroupIds: ["sub-b", "sub-a"],
      user,
    });

    expect(registerNode).toHaveBeenCalledWith(
      NODE_ID,
      `params-${GROUP_ID}-sub-a-sub-b`
    );
  });

  it("re-registers an already-registered node so a stale binding is rebound, without unregistering it after", async () => {
    isNodeRegistered.mockReturnValue(true);

    await waitForNodeOnline({ nodeId: NODE_ID, groupId: GROUP_ID, user });

    // Always rebinds — a leftover longer/stale shadow binding must be replaced.
    expect(registerNode).toHaveBeenCalledWith(NODE_ID, `params-${GROUP_ID}`);
    // But the binding is owned elsewhere, so cleanup must not unregister it.
    expect(unsubscribeFromNode).toHaveBeenCalledTimes(1);
    expect(unregisterNode).not.toHaveBeenCalled();
  });

  it("unregisters the temporary binding it created once the wait settles", async () => {
    await waitForNodeOnline({ nodeId: NODE_ID, groupId: GROUP_ID, user });

    expect(unsubscribeFromNode).toHaveBeenCalledTimes(1);
    expect(unregisterNode).toHaveBeenCalledWith(NODE_ID);
  });

  it("connects MQTT via the user before subscribing when the transport is not connected", async () => {
    getInstance.mockReturnValue({
      isConnected: jest.fn().mockResolvedValue(false),
    });

    await waitForNodeOnline({ nodeId: NODE_ID, groupId: GROUP_ID, user });

    expect(user.connectMQTT).toHaveBeenCalledTimes(1);
  });

  it("resolves when a live MQTT shadow update reports online", async () => {
    // GET polls never see the node online; only the pushed update does.
    getShadow.mockResolvedValue({ reported: { online: false } });
    subscribeToNode.mockImplementation(
      async (_nodeId: string, callback: (payload: unknown) => void) => {
        setTimeout(() => {
          callback({ state: { reported: { online: true } } });
        }, 0);
      }
    );

    await expect(
      waitForNodeOnline({ nodeId: NODE_ID, groupId: GROUP_ID, user })
    ).resolves.toBeUndefined();
    expect(unsubscribeFromNode).toHaveBeenCalledTimes(1);
  });

  it("rejects with NODE_ONLINE_TIMEOUT when the node never reports online", async () => {
    jest.useFakeTimers();
    try {
      // Shadow does not exist yet (expected right after provisioning).
      getShadow.mockRejectedValue(new Error("Shadow request rejected: 404"));

      const promise = waitForNodeOnline({
        nodeId: NODE_ID,
        groupId: GROUP_ID,
        user,
        timeoutMs: 1_000,
        pollIntervalMs: 200,
      });
      const expectation = expect(promise).rejects.toMatchObject({
        code: ProvErrorCodes.NODE_ONLINE_TIMEOUT,
      });

      await jest.advanceTimersByTimeAsync(1_100);

      await expectation;
      await expect(promise).rejects.toBeInstanceOf(ESPProvError);
      // Temporary subscription is cleaned up even on timeout.
      expect(unsubscribeFromNode).toHaveBeenCalledTimes(1);
      expect(unregisterNode).toHaveBeenCalledWith(NODE_ID);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("isNodeOnlineFromShadowPayload", () => {
  it("detects online from a live MQTT message shape", () => {
    expect(
      isNodeOnlineFromShadowPayload({ state: { reported: { online: true } } })
    ).toBe(true);
  });

  it("detects online from a getShadow state slice", () => {
    expect(isNodeOnlineFromShadowPayload({ reported: { online: true } })).toBe(
      true
    );
  });

  it("is false for offline, unrelated, and malformed payloads", () => {
    expect(
      isNodeOnlineFromShadowPayload({ state: { reported: { online: false } } })
    ).toBe(false);
    expect(isNodeOnlineFromShadowPayload({ reported: { x: 1 } })).toBe(false);
    expect(isNodeOnlineFromShadowPayload({})).toBe(false);
    expect(isNodeOnlineFromShadowPayload(null)).toBe(false);
    expect(isNodeOnlineFromShadowPayload("online")).toBe(false);
  });
});
