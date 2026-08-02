/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoSubscriptionManager } from "../../../src/services/ESPRMNeoSubscriptionManager";
import {
  ESPNodeUpdateData,
  ESPSubscriptionChannelInterface,
  NodeLike,
} from "../../../src/types/subscription";

/**
 * Demonstrates that a satellite SDK can add a new transport (e.g. Matter or BLE)
 * purely by implementing ESPSubscriptionChannelInterface and registering it with
 * the manager — no changes to the manager, the base MQTT channel, or app code.
 * This is the extension point the base SDK provides for Matter/BLE channels,
 * which live in their own SDKs rather than in base.
 */
class FakeMatterChannel implements ESPSubscriptionChannelInterface {
  readonly channelId = "matter";
  emit?: (update: ESPNodeUpdateData) => void;

  // Only "matter-capable" nodes are supported (capability-gated, like the real one).
  supportsNode(node: NodeLike): boolean {
    return node.metadata?.matter === true;
  }

  async initialize(): Promise<void> {}

  async subscribe(
    callback: (update: ESPNodeUpdateData) => void,
    node: NodeLike
  ): Promise<void> {
    const nodeId = node.id ?? node.nodeId ?? "";
    // A real channel would talk to the Matter fabric; here we just expose the
    // callback so the test can push an attribute report through it.
    this.emit = (u) => callback({ ...u, nodeId });
  }

  async unsubscribe(): Promise<void> {
    this.emit = undefined;
  }

  async dispose(): Promise<void> {
    this.emit = undefined;
  }
}

/** Minimal MQTT-like channel that records what it served. */
class FakeMqttChannel implements ESPSubscriptionChannelInterface {
  readonly channelId = "mqtt";
  served: string[] = [];
  supportsNode(): boolean {
    return true;
  }
  async initialize(): Promise<void> {}
  async subscribe(
    _cb: (u: ESPNodeUpdateData) => void,
    node: NodeLike
  ): Promise<void> {
    const nodeId = node.id ?? node.nodeId ?? "";
    this.served.push(nodeId);
  }
  async unsubscribe(): Promise<void> {}
  async dispose(): Promise<void> {}
}

describe("Subscription channel extensibility (Matter/BLE plug-in point)", () => {
  let manager: ESPRMNeoSubscriptionManager;
  let mqtt: FakeMqttChannel;
  let matter: FakeMatterChannel;

  beforeEach(async () => {
    manager = new ESPRMNeoSubscriptionManager();
    mqtt = new FakeMqttChannel();
    matter = new FakeMatterChannel();
    await manager.registerChannel(mqtt, false);
    await manager.registerChannel(matter, false);
    // Matter preferred, MQTT fallback (as a Matter satellite SDK would set).
    manager.setGlobalChannelOrder(["matter", "mqtt"]);
  });

  it("selects the Matter channel for a Matter-capable node", async () => {
    const received: ESPNodeUpdateData[] = [];
    const node: NodeLike = { id: "m-1", metadata: { matter: true } };

    await manager.subscribeToNode(node, (u) => received.push(u));
    matter.emit?.({
      nodeId: "ignored",
      source: "matter",
      eventType: "com.espressif.event.nodeParamsChanged",
      payload: { Light: { power: true } },
      metadata: { endpointId: 1, clusterId: 6 },
    });

    expect(received).toHaveLength(1);
    expect(received[0].source).toBe("matter");
    expect(received[0].nodeId).toBe("m-1");
    // MQTT was not used for this node.
    expect(mqtt.served).not.toContain("m-1");
  });

  it("falls back to MQTT for a non-Matter node (Matter doesn't support it)", async () => {
    const node: NodeLike = { id: "c-1" }; // no matter capability

    await manager.subscribeToNode(node, () => {});

    expect(mqtt.served).toContain("c-1");
  });

  it("honors a per-node channel order override", async () => {
    // This Matter-capable node is pinned to MQTT-only via its subscriptionConfig.
    const node: NodeLike = {
      id: "m-2",
      metadata: { matter: true },
      subscriptionConfig: { channelOrder: ["mqtt"] },
    };

    await manager.subscribeToNode(node, () => {});

    expect(mqtt.served).toContain("m-2");
    expect(matter.emit).toBeUndefined(); // matter channel never subscribed
  });
});
