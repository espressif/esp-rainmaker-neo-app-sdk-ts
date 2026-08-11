/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { ESPTransportMode, ESPTransportConfig } from "../../src/types/transport";

/** A node instance without running the heavy constructor (no MQTT attach). */
function makeNode(): ESPRMNeoNode {
  const node = Object.create(ESPRMNeoNode.prototype) as ESPRMNeoNode;
  node.availableTransports = {};
  node.transportOrder = [];
  node.connectivityStatus = { isConnected: false, lastConnectionTimestamp: 0 };
  return node;
}

const localConfig: ESPTransportConfig = {
  type: ESPTransportMode.local,
  metadata: { baseUrl: "http://192.168.1.10" },
};

describe("ESPRMNeoNode generic transport management", () => {
  it("addTransport adds and replaces an available transport by mode", () => {
    const node = makeNode();
    node.addTransport(ESPTransportMode.local, localConfig);
    expect(node.availableTransports[ESPTransportMode.local]).toEqual(localConfig);

    const replacement: ESPTransportConfig = {
      type: ESPTransportMode.local,
      metadata: { baseUrl: "http://10.0.0.5" },
    };
    node.addTransport(ESPTransportMode.local, replacement);
    expect(node.availableTransports[ESPTransportMode.local]).toEqual(replacement);
  });

  it("addTransport works for a custom string mode", () => {
    const node = makeNode();
    const cfg: ESPTransportConfig = { type: "bluetooth", metadata: { mac: "AA:BB" } };
    node.addTransport("bluetooth", cfg);
    expect(node.availableTransports.bluetooth).toEqual(cfg);
  });

  it("removeTransport deletes an available transport by mode", () => {
    const node = makeNode();
    node.addTransport(ESPTransportMode.local, localConfig);
    node.removeTransport(ESPTransportMode.local);
    expect(node.availableTransports[ESPTransportMode.local]).toBeUndefined();
  });

  it("add/removeCustomTransportManager manages the custom manager map lazily", () => {
    const node = makeNode();
    const manager = { setParam: jest.fn(), getParams: jest.fn() };

    node.addCustomTransportManager("bluetooth", manager);
    expect(node.customTransportManagers?.bluetooth).toBe(manager);

    node.removeCustomTransportManager("bluetooth");
    expect(node.customTransportManagers?.bluetooth).toBeUndefined();
    // Removing when nothing is registered must not throw.
    expect(() => makeNode().removeCustomTransportManager("x")).not.toThrow();
  });

  it("processNodeUpdate adds mqtt when online and removes it when offline", () => {
    const node = makeNode();
    node.nodeId = "n1";
    node.config = { node_id: "n1" } as ESPRMNeoNode["config"];
    (node as any).wireConfig = { node_id: "n1", devices: [], services: [] };

    (node as any).processNodeUpdate({
      state: { reported: { online: true } },
    });
    expect(node.availableTransports[ESPTransportMode.mqtt]).toEqual({
      type: ESPTransportMode.mqtt,
      metadata: {},
    });
    expect(node.connectivityStatus.isConnected).toBe(true);

    (node as any).processNodeUpdate({
      state: { reported: { online: false } },
    });
    expect(node.availableTransports[ESPTransportMode.mqtt]).toBeUndefined();
    expect(node.connectivityStatus.isConnected).toBe(false);
  });
});
