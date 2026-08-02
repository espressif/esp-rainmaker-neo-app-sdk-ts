/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resolves an MQTT endpoint to a WebSocket MQTT URL (wss://host/mqtt).
 * Strips any existing protocol or /mqtt path from the input and returns a normalized URL.
 *
 * @param mqttEndpoint - Raw MQTT endpoint (e.g. "xxxxx-ats.iot.region.amazonaws.com" or "wss://.../mqtt").
 * @returns Normalized URL "wss://{host}/mqtt" for use with MQTT over WebSocket.
 * @throws Error if endpoint is empty.
 */
export function resolveMqttWebSocketEndpoint(mqttEndpoint: string): string {
  if (!mqttEndpoint || typeof mqttEndpoint !== "string") {
    throw new Error("Invalid MQTT endpoint: endpoint is required");
  }
  const trimmed = mqttEndpoint.trim();
  const cleanEndpoint = trimmed
    .replace(/^https?:\/\//, "")
    .replace(/^wss?:\/\//, "")
    .replace(/\/mqtt\/?$/, "");
  return `wss://${cleanEndpoint}/mqtt`;
}
