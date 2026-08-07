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
  unsubscribe: jest.Mock;
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
    unsubscribe: jest
      .fn()
      .mockImplementation(async (topic: string) => {
        handlers.delete(topic);
      }),
    handlers,
  } as unknown as MockTransport;
}

const NODE_ID = "n1";
/** Membership shadow while the node sits in a subgroup. */
const SUBGROUP_SHADOW = "params-g1-sub1";
/** Home-only membership shadow after leaving the subgroup. */
const HOME_SHADOW = "params-g1";

function wildcardTopic(shadow: string, suffix: string): string {
  return `$aws/things/+/shadow/name/${shadow}${suffix}`;
}

/** Delivers an update/documents message on the given shadow's wildcard handler. */
function deliver(
  transport: MockTransport,
  shadow: string,
  payload: unknown
): void {
  const handler = transport.handlers.get(
    wildcardTopic(shadow, "/update/documents")
  );
  expect(handler).toBeDefined();
  handler!(
    `$aws/things/${NODE_ID}/shadow/name/${shadow}/update/documents`,
    Buffer.from(JSON.stringify(payload))
  );
}

const ONLINE_DOC = {
  previous: {},
  current: { state: { reported: { online: true } } },
};

describe("NodeMQTTOrchestrator.registerNode shadow rename (stale membership rebind)", () => {
  let transport: MockTransport;

  beforeEach(() => {
    NodeMQTTOrchestrator.clear();
    transport = makeTransport();
    NodeMQTTOrchestrator.initialize(transport);
  });

  afterEach(() => {
    NodeMQTTOrchestrator.clear();
  });

  it("rebinds to a shorter shadow name (membership shrink) instead of ignoring it", async () => {
    // Stale binding left over from a previous membership (e.g. provisioning
    // registered the subgroup shadow, but the node now lives on the home shadow).
    NodeMQTTOrchestrator.registerNode(NODE_ID, SUBGROUP_SHADOW);
    const staleListener = jest.fn();
    await NodeMQTTOrchestrator.subscribeToNode(NODE_ID, staleListener);

    // Previously a shorter name was silently ignored, leaving the node bound
    // to the stale (longer) shadow. It must rebind now.
    NodeMQTTOrchestrator.registerNode(NODE_ID, HOME_SHADOW);

    const listener = jest.fn();
    await NodeMQTTOrchestrator.subscribeToNode(NODE_ID, listener);

    deliver(transport, HOME_SHADOW, ONLINE_DOC);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      state: { reported: { online: true } },
    });

    // The stale binding was fully cleaned up: old wildcard topics were
    // unsubscribed on the wire and its listener never receives anything.
    expect(transport.unsubscribe).toHaveBeenCalledWith(
      wildcardTopic(SUBGROUP_SHADOW, "/update/documents"),
      expect.any(Function)
    );
    expect(
      transport.handlers.has(wildcardTopic(SUBGROUP_SHADOW, "/update/documents"))
    ).toBe(false);
    expect(staleListener).not.toHaveBeenCalled();
  });

  it("rebinds to a longer shadow name (membership growth)", async () => {
    NodeMQTTOrchestrator.registerNode(NODE_ID, HOME_SHADOW);
    await NodeMQTTOrchestrator.subscribeToNode(NODE_ID, jest.fn());

    NodeMQTTOrchestrator.registerNode(NODE_ID, SUBGROUP_SHADOW);

    const listener = jest.fn();
    await NodeMQTTOrchestrator.subscribeToNode(NODE_ID, listener);

    deliver(transport, SUBGROUP_SHADOW, ONLINE_DOC);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(
      transport.handlers.has(wildcardTopic(HOME_SHADOW, "/update/documents"))
    ).toBe(false);
  });

  it("re-registering with the same shadow name keeps existing listeners", async () => {
    NodeMQTTOrchestrator.registerNode(NODE_ID, HOME_SHADOW);
    const listener = jest.fn();
    await NodeMQTTOrchestrator.subscribeToNode(NODE_ID, listener);

    // e.g. waitForNodeOnline always re-registers; a same-name call must not
    // wipe listeners owned by an earlier subscriber.
    NodeMQTTOrchestrator.registerNode(NODE_ID, HOME_SHADOW);

    deliver(transport, HOME_SHADOW, ONLINE_DOC);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(transport.unsubscribe).not.toHaveBeenCalled();
  });
});
