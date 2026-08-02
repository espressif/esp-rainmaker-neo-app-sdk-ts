/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPMQTTConfig } from "../ESPRMNeoMqtt/ESPMQTTConfig";

/**
 * MQTT Transport interface - abstraction over MQTT client.
 * Used by NodeMQTTOrchestrator for all MQTT operations.
 */
export interface MQTTTransport {
  /**
   * Connect to MQTT using the provided configuration.
   *
   * @param config - MQTT configuration
   */
  connect(config: ESPMQTTConfig): Promise<void>;

  /**
   * Disconnect from MQTT.
   */
  disconnect(): Promise<void>;

  /**
   * Check if the MQTT client is connected.
   */
  isConnected(): Promise<boolean>;

  /**
   * Publish a message to a topic.
   *
   * @param topic - MQTT topic to publish to
   * @param payload - Message payload to publish
   */
  publish(topic: string, payload: string | Buffer): Promise<void>;

  /**
   * Subscribe to a topic with a message handler.
   *
   * @param topic - MQTT topic to subscribe to
   * @param handler - Callback invoked when a message is received on the topic
   *
   * @remarks
   * The handler function reference is used to manage subscriptions.
   * The same handler must be passed to `unsubscribe` to remove it.
   */
  subscribe(
    topic: string,
    handler: (topic: string, payload: Buffer) => void
  ): Promise<void>;

  /**
  * Unsubscribe from a topic.
  *
  * @param topic - MQTT topic to unsubscribe from
  * @param handler - Optional handler to remove
  *
  * @remarks
  * If a handler was provided during subscription, the same function reference
  * must be passed to successfully unsubscribe it.
  *
  * Passing a different function (even if identical in implementation) will not
  * remove the original handler.
  *
  * If handler is omitted, all handlers for the topic may be removed,
  * depending on the implementation.
  */
  unsubscribe(
    topic: string,
    handler?: (topic: string, payload: Buffer) => void
  ): Promise<void>;

  /**
  * @remarks
  * Optional helper for request-response patterns. Invokes the handler once
  * and auto-unsubscribes. Not required by NodeMQTTOrchestrator.
  */
  once?(
    topic: string,
    handler: (topic: string, payload: Buffer) => void
  ): Promise<void>;
}
