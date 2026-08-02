/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveMqttWebSocketEndpoint } from "../../src/utils/mqtt";

describe("resolveMqttWebSocketEndpoint", () => {
  it("should convert bare hostname to wss URL", () => {
    expect(
      resolveMqttWebSocketEndpoint("xxx-ats.iot.us-east-1.amazonaws.com")
    ).toBe("wss://xxx-ats.iot.us-east-1.amazonaws.com/mqtt");
  });

  it("should strip existing https:// prefix", () => {
    expect(
      resolveMqttWebSocketEndpoint(
        "https://xxx-ats.iot.us-east-1.amazonaws.com"
      )
    ).toBe("wss://xxx-ats.iot.us-east-1.amazonaws.com/mqtt");
  });

  it("should strip existing wss:// prefix", () => {
    expect(
      resolveMqttWebSocketEndpoint(
        "wss://xxx-ats.iot.us-east-1.amazonaws.com"
      )
    ).toBe("wss://xxx-ats.iot.us-east-1.amazonaws.com/mqtt");
  });

  it("should throw for empty endpoint", () => {
    expect(() => resolveMqttWebSocketEndpoint("")).toThrow(
      "endpoint is required"
    );
  });

  it("should throw for non-string endpoint", () => {
    expect(() => resolveMqttWebSocketEndpoint(null as any)).toThrow(
      "endpoint is required"
    );
  });

  it("should accept any domain as MQTT endpoint", () => {
    expect(resolveMqttWebSocketEndpoint("mqtt.example.com")).toBe(
      "wss://mqtt.example.com/mqtt"
    );
  });

  it("should trim whitespace", () => {
    expect(
      resolveMqttWebSocketEndpoint(
        "  xxx-ats.iot.us-east-1.amazonaws.com  "
      )
    ).toBe("wss://xxx-ats.iot.us-east-1.amazonaws.com/mqtt");
  });
});
