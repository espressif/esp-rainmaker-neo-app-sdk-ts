/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

jest.mock("../../src/services/NodeMQTTOrchestrator", () => ({
  NodeMQTTOrchestrator: {
    setParams: jest.fn(),
    getParams: jest.fn(),
  },
}));

import { NodeMQTTOrchestrator } from "../../src/services/NodeMQTTOrchestrator";
import { ESPMqttTransport } from "../../src/services/ESPTransport/ESPMqttTransport";

const setParams = NodeMQTTOrchestrator.setParams as jest.Mock;
const getParams = NodeMQTTOrchestrator.getParams as jest.Mock;

describe("ESPMqttTransport", () => {
  beforeEach(() => {
    setParams.mockResolvedValue(undefined);
    getParams.mockResolvedValue({ Switch: { Power: true } });
  });

  it("setParam publishes the inner payload via the MQTT orchestrator", async () => {
    const transport = new ESPMqttTransport();
    const res = await transport.setParam({
      node_id: "n1",
      payload: { Switch: { Power: true } },
    });
    expect(setParams).toHaveBeenCalledWith("n1", { Switch: { Power: true } });
    expect(res.statusCode).toBe(200);
  });

  it("getParams returns the reported params from the orchestrator", async () => {
    const transport = new ESPMqttTransport();
    const res = await transport.getParams({ node_id: "n1" });
    expect(getParams).toHaveBeenCalledWith("n1");
    expect(res).toEqual({ Switch: { Power: true } });
  });

  it("getParams returns whatever the orchestrator reports", async () => {
    getParams.mockResolvedValue({});
    const transport = new ESPMqttTransport();
    await expect(transport.getParams({ node_id: "n1" })).resolves.toEqual({});
  });
});
