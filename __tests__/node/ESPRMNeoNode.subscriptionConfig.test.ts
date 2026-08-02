/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Importing the method module applies the prototype augmentation under test.
import "../../src/methods/ESPRMNeoNode/SubscriptionConfig";
import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";

jest.mock("../../src/ESPRMNeoBase", () => ({
  ESPRMNeoBase: {
    subscriptionManager: {
      getEffectiveChannelOrder: jest.fn(),
    },
  },
}));

/** A node instance without running the heavy constructor (no MQTT attach). */
function makeNode(): ESPRMNeoNode {
  return Object.create(ESPRMNeoNode.prototype) as ESPRMNeoNode;
}

describe("ESPRMNeoNode subscription channel order", () => {
  it("setSubscriptionChannelOrder stores the order in subscriptionConfig", () => {
    const node = makeNode();
    node.setSubscriptionChannelOrder(["matter", "mqtt"]);
    expect(node.subscriptionConfig?.channelOrder).toEqual(["matter", "mqtt"]);
  });

  it("clearSubscriptionChannelOrder removes the per-node order", () => {
    const node = makeNode();
    node.setSubscriptionChannelOrder(["matter", "mqtt"]);
    node.clearSubscriptionChannelOrder();
    expect(node.subscriptionConfig?.channelOrder).toBeUndefined();
  });

  it("getSubscriptionChannelOrder delegates to the manager's effective order", () => {
    const node = makeNode();
    (
      ESPRMNeoBase.subscriptionManager.getEffectiveChannelOrder as jest.Mock
    ).mockReturnValue(["mqtt"]);

    expect(node.getSubscriptionChannelOrder()).toEqual(["mqtt"]);
    expect(
      ESPRMNeoBase.subscriptionManager.getEffectiveChannelOrder
    ).toHaveBeenCalledWith(node);
  });
});
