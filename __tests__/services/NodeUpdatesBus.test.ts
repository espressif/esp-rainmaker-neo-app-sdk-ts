/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  subscribeNodeUpdates,
  emitNodeUpdate,
  clearNodeUpdateListeners,
} from "../../src/services/NodeUpdatesBus";
import { ESPNodeUpdateData } from "../../src/types/subscription";

const update: ESPNodeUpdateData = {
  nodeId: "node-1",
  source: "mqtt",
  eventType: "com.espressif.event.nodeParamsChanged",
  payload: { Light: { power: true } },
};

describe("NodeUpdatesBus", () => {
  afterEach(() => clearNodeUpdateListeners());

  it("delivers updates to all subscribers", () => {
    const a = jest.fn();
    const b = jest.fn();
    subscribeNodeUpdates(a);
    subscribeNodeUpdates(b);

    emitNodeUpdate(update);

    expect(a).toHaveBeenCalledWith(update);
    expect(b).toHaveBeenCalledWith(update);
  });

  it("stops delivery after the returned unsubscribe is called", () => {
    const a = jest.fn();
    const unsub = subscribeNodeUpdates(a);

    unsub();
    emitNodeUpdate(update);

    expect(a).not.toHaveBeenCalled();
  });

  it("isolates a throwing listener from the others", () => {
    const bad = jest.fn(() => {
      throw new Error("boom");
    });
    const good = jest.fn();
    subscribeNodeUpdates(bad);
    subscribeNodeUpdates(good);

    expect(() => emitNodeUpdate(update)).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("clearNodeUpdateListeners removes everything", () => {
    const a = jest.fn();
    subscribeNodeUpdates(a);

    clearNodeUpdateListeners();
    emitNodeUpdate(update);

    expect(a).not.toHaveBeenCalled();
  });
});
