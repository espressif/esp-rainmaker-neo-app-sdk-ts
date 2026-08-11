/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MQTTTransport } from "../interfaces/MQTTTransport";
import type { ESPMQTTConfig } from "./ESPMQTTConfig";

/**
 * Singleton `MQTTTransport` that forwards calls to the transport passed to
 * {@link ESPRMNeoMqtt.initialize}. Use with `NodeMQTTOrchestrator` as in the
 * example below.
 *
 * @example
 * ```ts
 * ESPRMNeoMqtt.initialize(mqttTransport);
 * NodeMQTTOrchestrator.initialize(ESPRMNeoMqtt.getInstance());
 * ```
 */
export class ESPRMNeoMqtt implements MQTTTransport {
  static #instance: ESPRMNeoMqtt | undefined;
  #adapter: MQTTTransport;

  /**
   * @param adapter - Transport to wrap (typically a concrete MQTT client adapter).
   */
  private constructor(adapter: MQTTTransport) {
    this.#adapter = adapter;
  }

  /**
   * Initializes the singleton with an MQTT transport.
   * Must be called before {@link ESPRMNeoMqtt.getInstance}.
   *
   * @param adapter - `MQTTTransport` implementation to delegate to.
   * @throws {Error} If already initialized. Call {@link ESPRMNeoMqtt.clear}
   *   first if you genuinely need to re-init (e.g. between test cases). A
   *   silent replacement is refused because in-flight subscriptions on the
   *   old adapter would be orphaned and messages would split between the
   *   two live transports.
   */
  static initialize(adapter: MQTTTransport): void {
    if (this.#instance) {
      throw new Error(
        "ESPRMNeoMqtt already initialized. Call clear() first if you truly need to re-init."
      );
    }
    this.#instance = new ESPRMNeoMqtt(adapter);
  }

  /**
   * Returns the singleton instance.
   *
   * @throws {Error} If {@link ESPRMNeoMqtt.initialize} was not called.
   */
  static getInstance(): ESPRMNeoMqtt {
    const instance = this.#instance;
    if (!instance) {
      throw new Error(
        "ESPRMNeoMqtt not initialized. Call initialize(adapter) first."
      );
    }
    return instance;
  }

  /**
   * Clears the singleton.
   */
  static clear(): void {
    this.#instance = undefined;
  }

  /**
   * Returns true when {@link ESPRMNeoMqtt.initialize} has been called.
   * Safe to call before init (does not throw).
   */
  static hasInstance(): boolean {
    return this.#instance !== undefined;
  }

  /**
   * Connect to MQTT using the provided configuration.
   *
   * @param config - MQTT configuration
   */
  async connect(config: ESPMQTTConfig): Promise<void> {
    await this.#adapter.connect(config);
  }

  /**
   * Disconnect from MQTT.
   */
  async disconnect(): Promise<void> {
    await this.#adapter.disconnect();
  }

  /**
   * Returns whether the underlying MQTT client is connected.
   */
  isConnected(): Promise<boolean> {
    return this.#adapter.isConnected();
  }

  /**
   * Registers a transport connection-status listener when the underlying
   * adapter supports it; otherwise returns a no-op unsubscribe.
   *
   * @param callback - Invoked with `{ connected }` on status changes
   * @returns Unsubscribe function
   */
  onConnectionStatusChange(
    callback: (status: { connected: boolean }) => void
  ): () => void {
    if (typeof this.#adapter.onConnectionStatusChange === "function") {
      return this.#adapter.onConnectionStatusChange(callback);
    }
    return () => {};
  }

  /**
   * Publish a message to a topic.
   *
   * @param topic - MQTT topic to publish to
   * @param payload - Message payload to publish
   */
  async publish(topic: string, payload: string | Buffer): Promise<void> {
    await this.#adapter.publish(topic, payload);
  }

  /**
   * Subscribe to a topic with a message handler.
   *
   * @param topic - MQTT topic to subscribe to
   * @param handler - Callback invoked when a message is received on the topic
   */
  async subscribe(
    topic: string,
    handler: (topic: string, payload: Buffer) => void
  ): Promise<void> {
    await this.#adapter.subscribe(topic, handler);
  }

  /**
   * Unsubscribe from a topic, optionally removing a specific handler.
   *
   * @param topic - MQTT topic to unsubscribe from
   * @param handler - Callback that was used with {@link ESPRMNeoMqtt.subscribe}
   */
  async unsubscribe(
    topic: string,
    handler?: (topic: string, payload: Buffer) => void
  ): Promise<void> {
    await this.#adapter.unsubscribe(topic, handler);
  }
}

export type { ESPMQTTConfig } from "./ESPMQTTConfig";