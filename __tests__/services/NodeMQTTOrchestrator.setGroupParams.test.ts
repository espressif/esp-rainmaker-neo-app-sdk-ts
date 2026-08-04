/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeMQTTOrchestrator } from "../../src/services/NodeMQTTOrchestrator";
import type { MQTTTransport } from "../../src/services/interfaces/MQTTTransport";
import {
  assertValidSchema,
  type SchemaName,
} from "../../test-utils/schema-validator";

/** Validate a published MQTT payload against the AsyncAPI message schema. */
function expectValidMqttPayload(message: string, publishMock: jest.Mock): void {
  const [, raw] = publishMock.mock.calls[0];
  assertValidSchema(message as SchemaName, JSON.parse(raw as string));
}

describe("NodeMQTTOrchestrator.setGroupParams", () => {
  afterEach(() => {
    NodeMQTTOrchestrator.clear();
  });

  it("publishes to group broadcast topic", async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const transport: MQTTTransport = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      publish,
      isConnected: jest.fn().mockResolvedValue(true),
    };

    NodeMQTTOrchestrator.initialize(transport);
    await NodeMQTTOrchestrator.setGroupParams("grp1", { Light: { power: true } });

    expect(publish).toHaveBeenCalledWith(
      "rainmaker/nodes/groups/grp1/control",
      JSON.stringify({ Light: { power: true } })
    );
    expectValidMqttPayload("mqtt:groupControlMessage", publish);
  });

  it("publishes subgroup commands under the parent group namespace", async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const transport: MQTTTransport = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      publish,
      isConnected: jest.fn().mockResolvedValue(true),
    };

    NodeMQTTOrchestrator.initialize(transport);
    await NodeMQTTOrchestrator.setGroupParams("home1", { x: 1 }, "roomA");

    expect(publish).toHaveBeenCalledWith(
      "rainmaker/nodes/groups/home1/subgroups/roomA/control",
      JSON.stringify({ x: 1 })
    );
    expectValidMqttPayload("mqtt:groupControlMessage", publish);
  });

  it("throws when group id is empty", async () => {
    const transport: MQTTTransport = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      publish: jest.fn(),
      isConnected: jest.fn().mockResolvedValue(true),
    };

    NodeMQTTOrchestrator.initialize(transport);
    await expect(NodeMQTTOrchestrator.setGroupParams("", {})).rejects.toThrow(
      "Group ID is required"
    );
  });
});
