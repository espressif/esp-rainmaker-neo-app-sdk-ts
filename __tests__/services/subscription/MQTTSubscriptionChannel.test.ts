/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { MQTTSubscriptionChannel } from "../../../src/services/MQTTSubscriptionChannel";
import { NodeMQTTOrchestrator } from "../../../src/services/NodeMQTTOrchestrator";
import { ESPNodeUpdateData, NodeLike } from "../../../src/types/subscription";
import { NODE_PARAMS_CHANGED_EVENT } from "../../../src/services/ESPRMNeoHelpers/transformShadowToNodeUpdate";

jest.mock("../../../src/services/NodeMQTTOrchestrator", () => ({
  NodeMQTTOrchestrator: {
    isNodeRegistered: jest.fn(),
    registerNode: jest.fn(),
    subscribeToNode: jest.fn(),
    unsubscribeFromNode: jest.fn(),
    unregisterNode: jest.fn(),
    getGeneration: jest.fn(),
  },
}));

const mockOrchestrator = NodeMQTTOrchestrator as jest.Mocked<
  typeof NodeMQTTOrchestrator
>;

/**
 * Standard test node: constructShadowName("group-A", ["sub-1"]) =
 * "params-group-A-sub-1"
 */
const testNode: NodeLike = {
  id: "node-1",
  groupId: "group-A",
  subgroupIds: ["sub-1"],
};

/** Captures the listener the channel installs on the orchestrator. */
function captureListener(): { current?: (params: unknown) => void } {
  const ref: { current?: (params: unknown) => void } = {};
  mockOrchestrator.subscribeToNode.mockImplementation(
    async (_nodeId: string, listener: (params: unknown) => void) => {
      ref.current = listener;
    }
  );
  return ref;
}

describe("MQTTSubscriptionChannel (orchestrator delegate)", () => {
  let channel: MQTTSubscriptionChannel;

  beforeEach(() => {
    channel = new MQTTSubscriptionChannel();
    // Default: node not pre-registered, so the channel resolves + registers it.
    (mockOrchestrator.isNodeRegistered as jest.Mock).mockReturnValue(false);
    (mockOrchestrator.getGeneration as jest.Mock).mockReturnValue(1);
    mockOrchestrator.subscribeToNode.mockResolvedValue(undefined);
    mockOrchestrator.unsubscribeFromNode.mockResolvedValue(undefined);
  });

  describe("channelId / supportsNode", () => {
    it('uses the "mqtt" channel id', () => {
      expect(channel.channelId).toBe("mqtt");
    });

    it("supports every node", () => {
      expect(channel.supportsNode({})).toBe(true);
      expect(channel.supportsNode({ id: "node-1" })).toBe(true);
    });
  });

  describe("subscribe", () => {
    it("registers the node and subscribes via the orchestrator", async () => {
      await channel.subscribe(jest.fn(), testNode);

      expect(mockOrchestrator.registerNode).toHaveBeenCalledWith(
        "node-1",
        "params-group-A-sub-1"
      );
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledWith(
        "node-1",
        expect.any(Function)
      );
    });

    it("delivers a normalized ESPNodeUpdateData on each shadow message", async () => {
      const listener = captureListener();
      const cb = jest.fn();
      await channel.subscribe(cb, testNode);

      listener.current!({
        state: { reported: { Light: { power: true } } },
        version: 5,
        timestamp: 1234567890,
      });

      expect(cb).toHaveBeenCalledTimes(1);
      const update: ESPNodeUpdateData = cb.mock.calls[0][0];
      expect(update.nodeId).toBe("node-1");
      expect(update.source).toBe("mqtt");
      expect(update.eventType).toBe(NODE_PARAMS_CHANGED_EVENT);
      expect(update.payload).toEqual({ Light: { power: true } });
      expect(update.metadata).toMatchObject({
        shadowName: "params-group-A-sub-1",
        version: 5,
        timestamp: 1234567890,
      });
    });

    it("prefers state.reported.params when present", async () => {
      const listener = captureListener();
      const cb = jest.fn();
      await channel.subscribe(cb, testNode);

      listener.current!({
        state: { reported: { params: { Fan: { speed: 3 } }, online: true } },
      });

      expect(cb.mock.calls[0][0].payload).toEqual({ Fan: { speed: 3 } });
    });

    it("deduplicates the orchestrator subscription across callbacks for one node", async () => {
      const listener = captureListener();
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      await channel.subscribe(cb1, testNode);
      await channel.subscribe(cb2, testNode);

      // Only one orchestrator subscription / listener for the node.
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledTimes(1);

      listener.current!({ state: { reported: { Light: { power: false } } } });
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it("isolates subscriber errors from each other", async () => {
      const listener = captureListener();
      const bad = jest.fn(() => {
        throw new Error("subscriber blew up");
      });
      const good = jest.fn();
      await channel.subscribe(bad, testNode);
      await channel.subscribe(good, testNode);

      expect(() =>
        listener.current!({ state: { reported: { x: 1 } } })
      ).not.toThrow();
      expect(good).toHaveBeenCalledTimes(1);
    });

    it("throws when the node has no id", async () => {
      await expect(
        channel.subscribe(jest.fn(), { groupId: "group-A" } as NodeLike)
      ).rejects.toThrow(/requires a node with an id/);
    });

    it("constructs a group-level shadow when no subgroupIds are provided", async () => {
      await channel.subscribe(jest.fn(), { id: "node-x", groupId: "grp-only" });
      expect(mockOrchestrator.registerNode).toHaveBeenCalledWith(
        "node-x",
        "params-grp-only"
      );
    });

    it("re-attaches the listener after the orchestrator is re-initialized (logout→login)", async () => {
      const cb1 = jest.fn();
      await channel.subscribe(cb1, testNode);
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledTimes(1);

      // Simulate logout→login: the orchestrator is re-initialized → new generation.
      (mockOrchestrator.getGeneration as jest.Mock).mockReturnValue(2);
      const listener = captureListener();
      const cb2 = jest.fn();
      await channel.subscribe(cb2, testNode);

      // The channel detects the stale generation and re-attaches to the new orchestrator.
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledTimes(2);

      // The pre-relogin callback is dropped; only the fresh subscriber receives updates.
      listener.current!({ state: { reported: { x: 1 } } });
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it("rolls back bookkeeping when the orchestrator subscribe fails", async () => {
      mockOrchestrator.subscribeToNode.mockRejectedValueOnce(
        new Error("subscribe failed")
      );
      await expect(channel.subscribe(jest.fn(), testNode)).rejects.toThrow(
        "subscribe failed"
      );

      // A subsequent retry installs a fresh subscription (no stale state).
      mockOrchestrator.subscribeToNode.mockResolvedValue(undefined);
      await channel.subscribe(jest.fn(), testNode);
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledTimes(2);
    });
  });

  describe("unsubscribe", () => {
    it("detaches the orchestrator listener for a node and stops delivery", async () => {
      const listener = captureListener();
      const cb = jest.fn();
      await channel.subscribe(cb, testNode);

      await channel.unsubscribe("node-1");

      expect(mockOrchestrator.unsubscribeFromNode).toHaveBeenCalledWith(
        "node-1",
        expect.any(Function)
      );
      // Delivering after unsubscribe must not reach the old callback.
      listener.current!({ state: { reported: { x: 1 } } });
      expect(cb).not.toHaveBeenCalled();
    });

    it("removes only the given callback and keeps siblings subscribed", async () => {
      const listener = captureListener();
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      await channel.subscribe(cb1, testNode);
      await channel.subscribe(cb2, testNode);

      await channel.unsubscribe("node-1", cb1);

      // A subscriber remains → the shared orchestrator listener stays attached.
      expect(mockOrchestrator.unsubscribeFromNode).not.toHaveBeenCalled();
      listener.current!({ state: { reported: { x: 1 } } });
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);

      // Removing the last subscriber fully detaches the node.
      await channel.unsubscribe("node-1", cb2);
      expect(mockOrchestrator.unsubscribeFromNode).toHaveBeenCalledTimes(1);
    });

    it("does NOT unregister the node (so a node's own subscription survives)", async () => {
      await channel.subscribe(jest.fn(), testNode);
      await channel.unsubscribe("node-1");
      expect(mockOrchestrator.unregisterNode).not.toHaveBeenCalled();
    });

    it("detaches all nodes when called without a nodeId", async () => {
      await channel.subscribe(jest.fn(), testNode);
      await channel.subscribe(jest.fn(), {
        id: "node-2",
        groupId: "group-A",
        subgroupIds: [],
      });

      await channel.unsubscribe();

      expect(mockOrchestrator.unsubscribeFromNode).toHaveBeenCalledTimes(2);
    });

    it("is a no-op for an unknown node", async () => {
      await expect(channel.unsubscribe("unknown")).resolves.toBeUndefined();
      expect(mockOrchestrator.unsubscribeFromNode).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("detaches listeners without tearing down the shared MQTT connection", async () => {
      await channel.subscribe(jest.fn(), testNode);

      await channel.dispose();

      expect(mockOrchestrator.unsubscribeFromNode).toHaveBeenCalledTimes(1);
      // A single channel never disconnects the shared transport.
      expect(
        (mockOrchestrator as unknown as { clear?: jest.Mock }).clear
      ).toBeUndefined();
    });
  });

  describe("concurrency (per-node serialization)", () => {
    // A concurrent subscriber must not be silently dropped when the
    // first install's orchestrator subscribe rejects.
    it("does not drop a second subscriber when the first install fails", async () => {
      let captured: ((params: unknown) => void) | undefined;
      let firstCall = true;
      mockOrchestrator.subscribeToNode.mockImplementation(
        async (_nodeId: string, listener: (params: unknown) => void) => {
          if (firstCall) {
            firstCall = false;
            throw new Error("transient MQTT not connected");
          }
          captured = listener;
        }
      );

      const cbA = jest.fn();
      const cbB = jest.fn();
      // Map both to outcomes synchronously so neither rejection floats.
      const outcomes = await Promise.all([
        channel.subscribe(cbA, testNode).then(() => "ok", (e: Error) => e.message),
        channel.subscribe(cbB, testNode).then(() => "ok", (e: Error) => e.message),
      ]);

      // Exactly one install failed (the one that hit the transient error); the
      // other must have succeeded — NOT been silently dropped by the failure's
      // rollback. (Serialization makes which-one deterministic, but the invariant
      // is what matters here.)
      const oks = outcomes.filter((o) => o === "ok");
      const fails = outcomes.filter((o) => o !== "ok");
      expect(oks).toHaveLength(1);
      expect(fails).toHaveLength(1);
      expect(fails[0]).toContain("transient");

      // The surviving subscriber really is attached and receives updates.
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledTimes(2);
      const survivor = outcomes[0] === "ok" ? cbA : cbB;
      captured!({ state: { reported: { x: 1 } } });
      expect(survivor).toHaveBeenCalledTimes(1);
    });

    // A subscribe racing a detach in the same tick must end up
    // properly re-subscribed, not orphaned.
    it("re-subscribes cleanly when a subscribe races a detach", async () => {
      const listener = captureListener();
      await channel.subscribe(jest.fn(), testNode);
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledTimes(1);

      // Full detach + immediate re-subscribe, both in flight at once.
      const pDetach = channel.unsubscribe("node-1");
      const cb2 = jest.fn();
      const pSub = channel.subscribe(cb2, testNode);
      await Promise.all([pDetach, pSub]);

      // The node was torn down and freshly re-attached (not left orphaned).
      expect(mockOrchestrator.unsubscribeFromNode).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.subscribeToNode).toHaveBeenCalledTimes(2);
      listener.current!({ state: { reported: { x: 1 } } });
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });
});
