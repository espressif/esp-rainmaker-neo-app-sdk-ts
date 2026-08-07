/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoMqtt } from "../../src/services/ESPRMNeoMqtt/ESPRMNeoMqtt";
import type { MQTTTransport } from "../../src/services/interfaces/MQTTTransport";

function makeAdapter(extra?: Partial<MQTTTransport>): MQTTTransport {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockResolvedValue(true),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    ...extra,
  } as MQTTTransport;
}

describe("ESPRMNeoMqtt.onConnectionStatusChange", () => {
  beforeEach(() => {
    ESPRMNeoMqtt.clear();
  });

  afterEach(() => {
    ESPRMNeoMqtt.clear();
  });

  it("delegates to the adapter and returns its unsubscribe when supported", () => {
    let registered: ((status: { connected: boolean }) => void) | undefined;
    const adapterUnsubscribe = jest.fn();
    const onConnectionStatusChange = jest
      .fn()
      .mockImplementation((callback: (s: { connected: boolean }) => void) => {
        registered = callback;
        return adapterUnsubscribe;
      });
    ESPRMNeoMqtt.initialize(makeAdapter({ onConnectionStatusChange }));

    const listener = jest.fn();
    const unsubscribe =
      ESPRMNeoMqtt.getInstance().onConnectionStatusChange(listener);

    expect(onConnectionStatusChange).toHaveBeenCalledWith(listener);

    // Status emissions from the adapter flow through to the app listener.
    registered!({ connected: false });
    registered!({ connected: true });
    expect(listener).toHaveBeenNthCalledWith(1, { connected: false });
    expect(listener).toHaveBeenNthCalledWith(2, { connected: true });

    unsubscribe();
    expect(adapterUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("returns a safe no-op unsubscribe when the adapter does not support status callbacks", () => {
    ESPRMNeoMqtt.initialize(makeAdapter());

    const unsubscribe = ESPRMNeoMqtt.getInstance().onConnectionStatusChange(
      jest.fn()
    );

    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});
