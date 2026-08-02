/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const mockStartDiscovery = jest.fn();
const mockStopDiscovery = jest.fn();

jest.mock(
  "../../src/services/ESPTransport/ESPDiscovery/ESPDiscoveryManager",
  () => ({
    ESPDiscoveryManager: jest.fn().mockImplementation(() => ({
      startDiscovery: mockStartDiscovery,
      stopDiscovery: mockStopDiscovery,
    })),
  })
);

import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
// Load the prototype augmentation (subscribe/unsubscribe/trigger/...).
import "../../src/methods/ESPRMNeoUser/EventSubscription";
import { ESPDiscoveryManager } from "../../src/services/ESPTransport/ESPDiscovery/ESPDiscoveryManager";
import { ESPRMNeoEventType } from "../../src/types/discovery";
import { ESPTransportMode } from "../../src/types/transport";
import {
  emitNodeUpdate,
  clearNodeUpdateListeners,
} from "../../src/services/NodeUpdatesBus";
import { ESPNodeUpdateData } from "../../src/types/subscription";

/** A user instance without running the heavy constructor (tokens/MQTT/etc.). */
function makeUser(): ESPRMNeoUser {
  const user = Object.create(ESPRMNeoUser.prototype) as ESPRMNeoUser;
  // Mirror the class field initializers the real constructor would set.
  user.eventCallbacks = {};
  user.eventTeardowns = {};
  return user;
}

/** Minimal node exposing the generic client-facing transport helper. */
function makeNode() {
  return {
    availableTransports: {} as Record<string, unknown>,
    addTransport(mode: string, config: unknown) {
      this.availableTransports[mode] = config;
    },
  };
}

describe("ESPRMNeoUser local discovery subscription", () => {
  beforeEach(() => {
    // resetMocks wipes the constructor implementation between tests.
    (ESPDiscoveryManager as jest.Mock).mockImplementation(() => ({
      startDiscovery: mockStartDiscovery,
      stopDiscovery: mockStopDiscovery,
    }));
  });

  it("starts discovery and transforms each hit into ESPDiscoveredNodeData", () => {
    const user = makeUser();
    const received: any[] = [];
    user.subscribe(ESPRMNeoEventType.localDiscovery, (d: any) => received.push(d));

    expect(ESPDiscoveryManager).toHaveBeenCalledTimes(1);
    expect(mockStartDiscovery).toHaveBeenCalledTimes(1);

    // Simulate the adapter reporting a node on the LAN.
    const adapterCallback = mockStartDiscovery.mock.calls[0][0] as (info: Record<string, any>) => void;
    adapterCallback({ nodeId: "node-1", baseUrl: "http://192.168.1.42" });

    expect(received).toEqual([
      {
        nodeId: "node-1",
        transportDetails: {
          type: ESPTransportMode.local,
          metadata: { baseUrl: "http://192.168.1.42" },
        },
      },
    ]);
  });

  it("lets the client callback update the node's availableTransports", () => {
    const user = makeUser();
    const node = makeNode();
    user.subscribe(ESPRMNeoEventType.localDiscovery, (d: any) => {
      if (d.nodeId === "node-1") {
        node.addTransport(d.transportDetails.type, d.transportDetails);
      }
    });

    const adapterCallback = mockStartDiscovery.mock.calls[0][0] as (info: Record<string, any>) => void;
    adapterCallback({ nodeId: "node-1", baseUrl: "http://192.168.1.42" });

    expect(node.availableTransports[ESPTransportMode.local]).toEqual({
      type: ESPTransportMode.local,
      metadata: { baseUrl: "http://192.168.1.42" },
    });
  });

  it("forwards raw results for a custom discovery protocol with a config", () => {
    const user = makeUser();
    const received: any[] = [];
    const config = { serviceType: "_matter._tcp.", domain: "local" };
    user.subscribe("com.example.matter", (d: any) => received.push(d), config);

    expect(ESPDiscoveryManager).toHaveBeenCalledWith(config);

    const adapterCallback = mockStartDiscovery.mock.calls[0][0] as (info: Record<string, any>) => void;
    adapterCallback({ raw: "payload" });
    expect(received).toEqual([{ raw: "payload" }]);
  });

  it("does not start discovery for a custom event without a config", () => {
    const user = makeUser();
    user.subscribe("com.example.noop", jest.fn());
    expect(ESPDiscoveryManager).not.toHaveBeenCalled();
  });

  it("subscribing again for the same event replaces the previous callback", () => {
    const user = makeUser();
    const first = jest.fn();
    const second = jest.fn();
    user.subscribe("evt", first);
    user.subscribe("evt", second);

    user.trigger("evt", { x: 1 });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ x: 1 });
  });

  it("unsubscribe removes the event's callback; trigger then does nothing", () => {
    const user = makeUser();
    const cb = jest.fn();
    user.subscribe("evt", cb);

    user.unsubscribe("evt");
    user.trigger("evt", { x: 1 });

    expect(cb).not.toHaveBeenCalled();
  });

  it("removeAllCallbacks clears the callback for an event", () => {
    const user = makeUser();
    const cb = jest.fn();
    user.subscribe("evt", cb);
    user.removeAllCallbacks("evt");
    user.trigger("evt", {});
    expect(cb).not.toHaveBeenCalled();
  });

  it("unsubscribe stops the underlying local discovery browse", () => {
    const user = makeUser();
    user.subscribe(ESPRMNeoEventType.localDiscovery, jest.fn());
    expect(mockStartDiscovery).toHaveBeenCalledTimes(1);

    user.unsubscribe(ESPRMNeoEventType.localDiscovery);
    expect(mockStopDiscovery).toHaveBeenCalledTimes(1);
  });

  it("removeAllCallbacks stops the underlying local discovery browse", () => {
    const user = makeUser();
    user.subscribe(ESPRMNeoEventType.localDiscovery, jest.fn());

    user.removeAllCallbacks();
    expect(mockStopDiscovery).toHaveBeenCalledTimes(1);
  });

  it("re-subscribing the same event stops the previous browse before starting a new one", () => {
    const user = makeUser();
    user.subscribe(ESPRMNeoEventType.localDiscovery, jest.fn());
    user.subscribe(ESPRMNeoEventType.localDiscovery, jest.fn());

    // Previous browse stopped once; two browses started in total.
    expect(mockStopDiscovery).toHaveBeenCalledTimes(1);
    expect(mockStartDiscovery).toHaveBeenCalledTimes(2);
  });
});

describe("ESPRMNeoUser nodeUpdates subscription", () => {
  const update: ESPNodeUpdateData = {
    nodeId: "node-1",
    source: "mqtt",
    eventType: "com.espressif.event.nodeParamsChanged",
    payload: { Light: { power: true } },
  };

  afterEach(() => {
    clearNodeUpdateListeners();
  });

  it("delivers process-wide node updates to the subscriber", () => {
    const user = makeUser();
    const received: ESPNodeUpdateData[] = [];
    user.subscribe(ESPRMNeoEventType.nodeUpdates, (u: ESPNodeUpdateData) =>
      received.push(u)
    );

    emitNodeUpdate(update);

    expect(received).toEqual([update]);
  });

  it("stops delivery after unsubscribe (bus listener detached)", () => {
    const user = makeUser();
    const cb = jest.fn();
    user.subscribe(ESPRMNeoEventType.nodeUpdates, cb);

    user.unsubscribe(ESPRMNeoEventType.nodeUpdates);
    emitNodeUpdate(update);

    expect(cb).not.toHaveBeenCalled();
  });

  it("removeAllCallbacks detaches the bus listener", () => {
    const user = makeUser();
    const cb = jest.fn();
    user.subscribe(ESPRMNeoEventType.nodeUpdates, cb);

    user.removeAllCallbacks();
    emitNodeUpdate(update);

    expect(cb).not.toHaveBeenCalled();
  });

  it("re-subscribing replaces the previous bus listener (no duplicate delivery)", () => {
    const user = makeUser();
    const first = jest.fn();
    const second = jest.fn();
    user.subscribe(ESPRMNeoEventType.nodeUpdates, first);
    user.subscribe(ESPRMNeoEventType.nodeUpdates, second);

    emitNodeUpdate(update);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
