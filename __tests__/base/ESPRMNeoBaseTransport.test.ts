/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPTransportMode, DEFAULT_TRANSPORT_ORDER } from "../../src/types/transport";

describe("ESPRMNeoBase transport order", () => {
  afterEach(() => {
    // Restore the global default so other suites are unaffected.
    ESPRMNeoBase.setTransportOrder([...DEFAULT_TRANSPORT_ORDER]);
  });

  it("defaults to the documented local-first order", () => {
    expect(ESPRMNeoBase.getTransportOrder()).toEqual([
      ESPTransportMode.local,
      ESPTransportMode.mqtt,
    ]);
  });

  it("returns a copy (mutating the result does not affect the source)", () => {
    const order = ESPRMNeoBase.getTransportOrder();
    order.push("tampered");
    expect(ESPRMNeoBase.getTransportOrder()).toEqual([
      ESPTransportMode.local,
      ESPTransportMode.mqtt,
    ]);
  });

  it("setTransportOrder updates the global default", () => {
    ESPRMNeoBase.setTransportOrder([ESPTransportMode.mqtt, ESPTransportMode.local]);
    expect(ESPRMNeoBase.getTransportOrder()).toEqual([
      ESPTransportMode.mqtt,
      ESPTransportMode.local,
    ]);
  });

  it("setTransportOrder rejects an empty or invalid order", () => {
    expect(() => ESPRMNeoBase.setTransportOrder([])).toThrow();
    expect(() =>
      ESPRMNeoBase.setTransportOrder(undefined as unknown as string[])
    ).toThrow();
  });
});

describe("ESPRMNeoBase local discovery adapter", () => {
  it("setLocalDiscoveryAdapter throws before the SDK is initialized", () => {
    // No init() has run in this isolated unit suite.
    expect(() =>
      ESPRMNeoBase.setLocalDiscoveryAdapter({
        startDiscovery: jest.fn(),
        stopDiscovery: jest.fn(),
      })
    ).toThrow(/not initialized/i);
  });
});
