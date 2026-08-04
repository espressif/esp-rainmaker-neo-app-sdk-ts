/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { registerMqttChannelIfNeeded } from "../../../src/services/ESPRMNeoHelpers/ChannelRegistration";
import { ESPRMNeoSubscriptionManager } from "../../../src/services/ESPRMNeoSubscriptionManager";

describe("registerMqttChannelIfNeeded", () => {
  let manager: ESPRMNeoSubscriptionManager;

  beforeEach(() => {
    manager = new ESPRMNeoSubscriptionManager();
  });

  it("registers the MQTT channel and sets it as the default order", () => {
    registerMqttChannelIfNeeded(manager);

    expect(manager.getRegisteredChannels()).toContain("mqtt");
    // Order is set synchronously in the same tick (no async clobber window).
    expect(manager.getGlobalChannelOrder()).toEqual(["mqtt"]);
  });

  it("is idempotent — no duplicate registration on repeated calls", () => {
    registerMqttChannelIfNeeded(manager);
    registerMqttChannelIfNeeded(manager);

    expect(
      manager.getRegisteredChannels().filter((id) => id === "mqtt")
    ).toHaveLength(1);
  });

  it("does not override an order an app has already configured", () => {
    manager.setGlobalChannelOrder(["matter", "mqtt"]);
    registerMqttChannelIfNeeded(manager);

    expect(manager.getGlobalChannelOrder()).toEqual(["matter", "mqtt"]);
    expect(manager.getRegisteredChannels()).toContain("mqtt");
  });

  it("drives the manager lifecycle by calling initialize()", () => {
    const initSpy = jest.spyOn(manager, "initialize");
    registerMqttChannelIfNeeded(manager);
    expect(initSpy).toHaveBeenCalledTimes(1);
  });
});
