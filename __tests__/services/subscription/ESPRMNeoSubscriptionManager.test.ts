/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoSubscriptionManager } from "../../../src/services/ESPRMNeoSubscriptionManager";
import {
  ESPNodeUpdateData,
  ESPSubscriptionChannelInterface,
} from "../../../src/types/subscription";

function createMockChannel(
  id: string,
  overrides: Record<string, any> = {}
): jest.Mocked<ESPSubscriptionChannelInterface> {
  const base = {
    channelId: id,
    initialize: jest.fn().mockResolvedValue(undefined),
    supportsNode: jest.fn().mockReturnValue(true),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
  };
  return Object.assign(base, overrides) as any;
}

describe("ESPRMNeoSubscriptionManager", () => {
  let manager: ESPRMNeoSubscriptionManager;

  beforeEach(() => {
    manager = new ESPRMNeoSubscriptionManager();
  });

  describe("initialize", () => {
    it("should initialize all registered channels", async () => {
      const ch1 = createMockChannel("mqtt");
      const ch2 = createMockChannel("matter");
      await manager.registerChannel(ch1, false);
      await manager.registerChannel(ch2, false);

      await manager.initialize();

      expect(ch1.initialize).toHaveBeenCalledTimes(1);
      expect(ch2.initialize).toHaveBeenCalledTimes(1);
    });

    it("should be idempotent", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);

      await manager.initialize();
      await manager.initialize();

      expect(ch.initialize).toHaveBeenCalledTimes(1);
    });

    it("auto-initializes a channel registered after initialize()", async () => {
      await manager.initialize();

      const ch = createMockChannel("matter");
      // autoInitialize defaults to true; now that the manager is initialized it must fire.
      await manager.registerChannel(ch);

      expect(ch.initialize).toHaveBeenCalledTimes(1);
    });

    it("should continue initializing other channels if one fails", async () => {
      const ch1 = createMockChannel("mqtt", {
        initialize: jest.fn().mockRejectedValue(new Error("init failed")),
      });
      const ch2 = createMockChannel("matter");
      await manager.registerChannel(ch1, false);
      await manager.registerChannel(ch2, false);

      await manager.initialize();

      expect(ch2.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe("registerChannel", () => {
    it("should register a channel", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);

      expect(manager.getRegisteredChannels()).toEqual(["mqtt"]);
    });

    it("should throw when registering a duplicate channelId", async () => {
      const ch1 = createMockChannel("mqtt");
      const ch2 = createMockChannel("mqtt");
      await manager.registerChannel(ch1, false);

      await expect(manager.registerChannel(ch2, false)).rejects.toThrow(
        "Channel mqtt is already registered"
      );
    });

    it("should auto-initialize if manager is already initialized", async () => {
      await manager.initialize();
      const ch = createMockChannel("mqtt");

      await manager.registerChannel(ch, true);

      expect(ch.initialize).toHaveBeenCalledTimes(1);
    });

    it("should NOT auto-initialize if manager is not yet initialized", async () => {
      const ch = createMockChannel("mqtt");

      await manager.registerChannel(ch, true);

      expect(ch.initialize).not.toHaveBeenCalled();
    });

    it("should NOT auto-initialize when autoInitialize is false", async () => {
      await manager.initialize();
      const ch = createMockChannel("mqtt");

      await manager.registerChannel(ch, false);

      expect(ch.initialize).not.toHaveBeenCalled();
    });
  });

  describe("unregisterChannel", () => {
    it("should dispose and remove a channel", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);

      await manager.unregisterChannel("mqtt");

      expect(ch.dispose).toHaveBeenCalledTimes(1);
      expect(manager.getRegisteredChannels()).toEqual([]);
    });

    it("should do nothing for unknown channel", async () => {
      await expect(
        manager.unregisterChannel("nonexistent")
      ).resolves.toBeUndefined();
    });
  });

  describe("setGlobalChannelOrder", () => {
    it("should set the global channel order", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);

      manager.setGlobalChannelOrder(["mqtt"]);

      expect(manager.getGlobalChannelOrder()).toEqual(["mqtt"]);
    });

    it("should warn but still set order for unknown channels", async () => {
      manager.setGlobalChannelOrder(["unknown_channel"]);

      expect(manager.getGlobalChannelOrder()).toEqual(["unknown_channel"]);
    });
  });

  describe("getEffectiveChannelOrder", () => {
    it("should return node-specific order when present", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      const node = {
        id: "node-1",
        subscriptionConfig: { channelOrder: ["matter", "mqtt"] },
      };
      expect(manager.getEffectiveChannelOrder(node)).toEqual([
        "matter",
        "mqtt",
      ]);
    });

    it("should return global order when node has no custom order", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      const node = { id: "node-1" };
      expect(manager.getEffectiveChannelOrder(node)).toEqual(["mqtt"]);
    });

    it("falls back to global order when the per-node order is empty ([])", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      // A stray/rehydrated empty override must not trap the node.
      const node = { id: "node-1", subscriptionConfig: { channelOrder: [] } };
      expect(manager.getEffectiveChannelOrder(node)).toEqual(["mqtt"]);
    });
  });

  describe("getAvailableChannelsForNode", () => {
    it("should return channels that support the node in order", async () => {
      const mqttCh = createMockChannel("mqtt");
      const matterCh = createMockChannel("matter", {
        supportsNode: jest.fn().mockReturnValue(false),
      });
      await manager.registerChannel(mqttCh, false);
      await manager.registerChannel(matterCh, false);
      manager.setGlobalChannelOrder(["matter", "mqtt"]);

      const result = manager.getAvailableChannelsForNode({ id: "node-1" });

      expect(result).toHaveLength(1);
      expect(result[0].channelId).toBe("mqtt");
    });

    it("should return empty array when no channels match", async () => {
      const ch = createMockChannel("mqtt", {
        supportsNode: jest.fn().mockReturnValue(false),
      });
      await manager.registerChannel(ch, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      const result = manager.getAvailableChannelsForNode({ id: "node-1" });
      expect(result).toHaveLength(0);
    });
  });

  describe("subscribeToNode", () => {
    it("should subscribe via the first available channel", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      const callback = jest.fn();
      const node = { id: "node-1" };
      await manager.subscribeToNode(node, callback);

      expect(ch.subscribe).toHaveBeenCalledWith(callback, node);
    });

    it("should try next channel if first fails", async () => {
      const ch1 = createMockChannel("matter", {
        subscribe: jest.fn().mockRejectedValue(new Error("matter failed")),
      });
      const ch2 = createMockChannel("mqtt");
      await manager.registerChannel(ch1, false);
      await manager.registerChannel(ch2, false);
      manager.setGlobalChannelOrder(["matter", "mqtt"]);

      const callback = jest.fn();
      const node = { id: "node-1" };
      await manager.subscribeToNode(node, callback);

      expect(ch1.subscribe).toHaveBeenCalled();
      expect(ch2.subscribe).toHaveBeenCalledWith(callback, node);
    });

    it("should throw when no channels are available", async () => {
      await expect(
        manager.subscribeToNode({ id: "node-1" }, jest.fn())
      ).rejects.toThrow("No available subscription channels for node node-1");
    });

    it("enriches the no-channels error with effective order and unregistered ids", async () => {
      const mqtt = createMockChannel("mqtt");
      await manager.registerChannel(mqtt, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      // Node asks for a channel that is not registered ("matter").
      const node = {
        id: "node-1",
        subscriptionConfig: { channelOrder: ["matter"] },
      };
      await expect(manager.subscribeToNode(node, jest.fn())).rejects.toThrow(
        /Effective order: \[matter\].*Registered channels: \[mqtt\].*Unregistered ids in order: \[matter\]/s
      );
    });

    it("flags channels that are registered but do not support the node", async () => {
      const mqtt = createMockChannel("mqtt", {
        supportsNode: jest.fn().mockReturnValue(false),
      });
      await manager.registerChannel(mqtt, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      await expect(
        manager.subscribeToNode({ id: "node-1" }, jest.fn())
      ).rejects.toThrow(/Registered but unsupported for this node: \[mqtt\]/);
    });

    it("should throw with last error when all channels fail", async () => {
      const ch = createMockChannel("mqtt", {
        subscribe: jest
          .fn()
          .mockRejectedValue(new Error("connection refused")),
      });
      await manager.registerChannel(ch, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      await expect(
        manager.subscribeToNode({ id: "node-1" }, jest.fn())
      ).rejects.toThrow(
        "All subscription channels failed for node node-1. Last error: connection refused"
      );
    });
  });

  describe("subscribeToAllNodes", () => {
    it("should subscribe to all nodes", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      const callback = jest.fn();
      const nodes = [{ id: "node-1" }, { id: "node-2" }];

      await manager.subscribeToAllNodes(nodes, callback);

      expect(ch.subscribe).toHaveBeenCalledTimes(2);
    });

    it("should continue subscribing even if some nodes fail", async () => {
      const ch = createMockChannel("mqtt", {
        subscribe: jest
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error("fail"))
          .mockResolvedValueOnce(undefined),
      });
      await manager.registerChannel(ch, false);
      manager.setGlobalChannelOrder(["mqtt"]);

      const nodes = [{ id: "n1" }, { id: "n2" }, { id: "n3" }];
      await manager.subscribeToAllNodes(nodes, jest.fn());

      expect(ch.subscribe).toHaveBeenCalledTimes(3);
    });
  });

  describe("unsubscribeFromNode", () => {
    it("should unsubscribe from all channels for the node", async () => {
      const ch1 = createMockChannel("mqtt");
      const ch2 = createMockChannel("matter");
      await manager.registerChannel(ch1, false);
      await manager.registerChannel(ch2, false);

      await manager.unsubscribeFromNode("node-1");

      expect(ch1.unsubscribe).toHaveBeenCalledWith("node-1", undefined);
      expect(ch2.unsubscribe).toHaveBeenCalledWith("node-1", undefined);
    });

    it("forwards a specific callback to each channel (per-subscriber removal)", async () => {
      const ch1 = createMockChannel("mqtt");
      const ch2 = createMockChannel("matter");
      await manager.registerChannel(ch1, false);
      await manager.registerChannel(ch2, false);

      const cb = jest.fn();
      await manager.unsubscribeFromNode("node-1", cb);

      expect(ch1.unsubscribe).toHaveBeenCalledWith("node-1", cb);
      expect(ch2.unsubscribe).toHaveBeenCalledWith("node-1", cb);
    });

    it("should continue even if one channel fails to unsubscribe", async () => {
      const ch1 = createMockChannel("mqtt", {
        unsubscribe: jest.fn().mockRejectedValue(new Error("fail")),
      });
      const ch2 = createMockChannel("matter");
      await manager.registerChannel(ch1, false);
      await manager.registerChannel(ch2, false);

      await manager.unsubscribeFromNode("node-1");

      expect(ch2.unsubscribe).toHaveBeenCalledWith("node-1", undefined);
    });
  });

  describe("getRegisteredChannels", () => {
    it("should return empty array initially", () => {
      expect(manager.getRegisteredChannels()).toEqual([]);
    });

    it("should return registered channel IDs", async () => {
      await manager.registerChannel(createMockChannel("mqtt"), false);
      await manager.registerChannel(createMockChannel("matter"), false);

      expect(manager.getRegisteredChannels()).toEqual(["mqtt", "matter"]);
    });
  });

  describe("getGlobalChannelOrder", () => {
    it("should return empty array by default", () => {
      expect(manager.getGlobalChannelOrder()).toEqual([]);
    });

    it("should return a copy of the order", async () => {
      await manager.registerChannel(createMockChannel("mqtt"), false);
      manager.setGlobalChannelOrder(["mqtt"]);

      const order = manager.getGlobalChannelOrder();
      order.push("hacked");

      expect(manager.getGlobalChannelOrder()).toEqual(["mqtt"]);
    });
  });

  describe("dispose", () => {
    it("should dispose all channels and reset state", async () => {
      const ch1 = createMockChannel("mqtt");
      const ch2 = createMockChannel("matter");
      await manager.registerChannel(ch1, false);
      await manager.registerChannel(ch2, false);
      await manager.initialize();

      await manager.dispose();

      expect(ch1.dispose).toHaveBeenCalledTimes(1);
      expect(ch2.dispose).toHaveBeenCalledTimes(1);
      expect(manager.getRegisteredChannels()).toEqual([]);
    });

    it("should allow re-initialization after dispose", async () => {
      const ch = createMockChannel("mqtt");
      await manager.registerChannel(ch, false);
      await manager.initialize();
      await manager.dispose();

      const newCh = createMockChannel("mqtt");
      await manager.registerChannel(newCh, false);
      await manager.initialize();

      expect(newCh.initialize).toHaveBeenCalledTimes(1);
    });
  });
});
