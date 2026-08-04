/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const mockCloud = { setParam: jest.fn(), getParams: jest.fn() };
const mockLocal = { setParam: jest.fn(), getParams: jest.fn() };

jest.mock("../../src/services/ESPTransport/ESPMqttTransport", () => ({
  ESPMqttTransport: jest.fn().mockImplementation(() => mockCloud),
}));
jest.mock("../../src/services/ESPTransport/ESPLocalControlTransport", () => ({
  ESPLocalControlTransport: jest.fn().mockImplementation(() => mockLocal),
}));

import { ESPTransportManager } from "../../src/services/ESPTransport/ESPTransportManager";
import { ESPMqttTransport } from "../../src/services/ESPTransport/ESPMqttTransport";
import { ESPLocalControlTransport } from "../../src/services/ESPTransport/ESPLocalControlTransport";
import { ESPTransportMode } from "../../src/types/transport";

describe("ESPTransportManager", () => {
  beforeEach(() => {
    // resetMocks: true wipes mockImplementation between tests; re-establish it.
    (ESPMqttTransport as jest.Mock).mockImplementation(() => mockCloud);
    (ESPLocalControlTransport as jest.Mock).mockImplementation(() => mockLocal);
  });

  it("builds an ESPMqttTransport for cloud configs and delegates", async () => {
    mockCloud.setParam.mockResolvedValue({ statusCode: 200 });
    const mgr = new ESPTransportManager({
      type: ESPTransportMode.mqtt,
      metadata: {},
    });
    await mgr.setParam({ node_id: "n1", payload: {} });
    expect(ESPMqttTransport).toHaveBeenCalled();
    expect(mockCloud.setParam).toHaveBeenCalled();
  });

  it("builds an ESPLocalControlTransport for local configs and delegates", async () => {
    mockLocal.getParams.mockResolvedValue({});
    const config = {
      type: ESPTransportMode.local,
      metadata: { baseUrl: "http://x" },
    };
    const mgr = new ESPTransportManager(config);
    await mgr.getParams({ node_id: "n1" });
    expect(ESPLocalControlTransport).toHaveBeenCalledWith(config);
    expect(mockLocal.getParams).toHaveBeenCalled();
  });

  it("throws for an unsupported transport type", () => {
    expect(
      () => new ESPTransportManager({ type: "bluetooth", metadata: {} })
    ).toThrow(/Unsupported transport type/);
  });
});
