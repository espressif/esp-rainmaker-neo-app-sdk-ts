/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoSubscriptionManager } from "../ESPRMNeoSubscriptionManager";
import { MQTTSubscriptionChannel } from "../MQTTSubscriptionChannel";
import { SubscriptionChannelIds } from "../../utils/constants";
import { Logger } from "../../utils/logger";

const logger = new Logger("ChannelRegistration");

/**
 * Registers the MQTT subscription channel with the manager (idempotent) and,
 * if no global order has been set yet, makes MQTT the default channel.
 *
 * This runs **synchronously** on purpose: `registerChannel` adds the channel to
 * the manager's map before its first `await`, so by the time this function sets
 * the global order the channel is already present. Doing it synchronously avoids
 * the order-clobber race that consumer apps had to defend against (where an
 * async registration reset the channel order after the app had configured it).
 *
 * @param manager - The subscription manager to register the MQTT channel on.
 */
export function registerMqttChannelIfNeeded(
  manager: ESPRMNeoSubscriptionManager
): void {
  if (!manager.getRegisteredChannels().includes(SubscriptionChannelIds.MQTT)) {
    // registerChannel() updates the channel map synchronously; the returned
    // promise only awaits channel.initialize() when the manager is already
    // initialized. We don't await it here so the order can be set synchronously.
    manager
      .registerChannel(new MQTTSubscriptionChannel())
      .catch((error) =>
        logger.error("Failed to register MQTT subscription channel", error)
      );
  }

  if (manager.getGlobalChannelOrder().length === 0) {
    manager.setGlobalChannelOrder([SubscriptionChannelIds.MQTT]);
  }

  // Drive the manager lifecycle: initialize the registered channel(s) and flip
  // the manager's `initialized` flag. Without this, `registerChannel`'s
  // `autoInitialize` gate never fires, so a channel registered later by a
  // satellite SDK (Matter/BLE) would be left un-initialized (its connection /
  // cache warmup silently skipped). The MQTT channel's own lazy-init in
  // subscribe() is kept as a defensive fallback.
  void manager
    .initialize()
    .catch((error) =>
      logger.error("Failed to initialize subscription manager", error)
    );
}
