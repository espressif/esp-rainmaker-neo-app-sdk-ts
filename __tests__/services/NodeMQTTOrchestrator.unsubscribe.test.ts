/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeMQTTOrchestrator } from "../../src/services/NodeMQTTOrchestrator";
import type { MQTTTransport } from "../../src/services/interfaces/MQTTTransport";

type Handler = (topic: string, payload: Buffer) => void;

interface MockTransport extends MQTTTransport {
  handlers: Map<string, Handler>;
  isConnected: jest.Mock;
}

function makeTransport(): MockTransport {
  const handlers = new Map<string, Handler>();
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockResolvedValue(true),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest
      .fn()
      .mockImplementation(async (topic: string, handler: Handler) => {
        handlers.set(topic, handler);
      }),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    handlers,
  } as unknown as MockTransport;
}

const NODE_ID = "n1";
const SHADOW = "params-g1";
const TOPIC = `$aws/things/${NODE_ID}/shadow/name/${SHADOW}/update/documents`;

function deliver(transport: MockTransport, payload: unknown): void {
  // All wildcard topics share the same bound handler closure.
  const handler = [...transport.handlers.values()][0];
  handler(TOPIC, Buffer.from(JSON.stringify(payload)));
}

/** Delivers a message on a specific shadow-topic suffix (e.g. "/update/rejected"). */
function deliverOn(
  transport: MockTransport,
  suffix: string,
  payload: unknown
): void {
  const handler = [...transport.handlers.values()][0];
  const topic = `$aws/things/${NODE_ID}/shadow/name/${SHADOW}${suffix}`;
  handler(topic, Buffer.from(JSON.stringify(payload)));
}

describe("NodeMQTTOrchestrator.unsubscribeFromNode while disconnected (no listener leak)", () => {
  let transport: MockTransport;

  beforeEach(async () => {
    NodeMQTTOrchestrator.clear();
    transport = makeTransport();
    NodeMQTTOrchestrator.initialize(transport);
    NodeMQTTOrchestrator.registerNode(NODE_ID, SHADOW);
  });

  afterEach(() => {
    NodeMQTTOrchestrator.clear();
  });

  it("removes the listener even when MQTT is disconnected, so reconnect does not fan out to a stale listener", async () => {
    const listener = jest.fn();
    await NodeMQTTOrchestrator.subscribeToNode(NODE_ID, listener);

    // Sanity: a message reaches the listener while subscribed.
    deliver(transport, {
      previous: {},
      current: { state: { reported: { x: 1 } } },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    // Simulate a disconnect, then unsubscribe. Previously this threw
    // "MQTT not connected" before any bookkeeping, leaking the listener.
    transport.isConnected.mockResolvedValue(false);
    await expect(
      NodeMQTTOrchestrator.unsubscribeFromNode(NODE_ID, listener)
    ).resolves.toBeUndefined();

    // After reconnect a delivered message must NOT reach the removed listener.
    transport.isConnected.mockResolvedValue(true);
    deliver(transport, {
      previous: {},
      current: { state: { reported: { x: 2 } } },
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("NodeMQTTOrchestrator routes only reported-state messages", () => {
  let transport: MockTransport;

  beforeEach(() => {
    NodeMQTTOrchestrator.clear();
    transport = makeTransport();
    NodeMQTTOrchestrator.initialize(transport);
    NodeMQTTOrchestrator.registerNode(NODE_ID, SHADOW);
  });

  afterEach(() => {
    NodeMQTTOrchestrator.clear();
  });

  it("delivers update/documents and get/accepted but drops accepted, rejected and delta", async () => {
    const listener = jest.fn();
    await NodeMQTTOrchestrator.subscribeToNode(NODE_ID, listener);

    deliverOn(transport, "/update/documents", {
      previous: { state: { reported: { Light: { power: false } } } },
      current: { state: { reported: { Light: { power: true } } } },
    });
    deliverOn(transport, "/get/accepted", {
      state: { reported: { Light: { power: false } } },
    });
    // These must NOT reach param listeners (duplicates / errors / desired-vs-reported).
    deliverOn(transport, "/update/accepted", {
      state: { reported: { Light: { power: true } } },
    });
    deliverOn(transport, "/update/rejected", { code: 400, message: "bad" });
    deliverOn(transport, "/get/rejected", { code: 404, message: "no shadow" });
    deliverOn(transport, "/update/delta", {
      state: { Light: { power: true } },
    });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, {
      state: { reported: { Light: { power: true } } },
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      state: { reported: { Light: { power: false } } },
    });
  });
});
