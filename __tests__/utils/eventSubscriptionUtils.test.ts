/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const startDiscovery = jest.fn();
const stopDiscovery = jest.fn();

jest.mock(
  "../../src/services/ESPTransport/ESPDiscovery/ESPDiscoveryManager",
  () => ({
    ESPDiscoveryManager: jest
      .fn()
      .mockImplementation(() => ({ startDiscovery, stopDiscovery })),
  })
);

import { ESPDiscoveryManager } from "../../src/services/ESPTransport/ESPDiscovery/ESPDiscoveryManager";
import {
  startLocalDiscovery,
  toDiscoveredNodeData,
} from "../../src/utils/eventSubscriptionUtils";
import {
  ESPLocalControlProtocol,
  ESPTransportMode,
} from "../../src/types/transport";

describe("toDiscoveredNodeData", () => {
  it("tags the transport with the rmaker_local_ctrl protocol", () => {
    expect(
      toDiscoveredNodeData({ nodeId: "n1", baseUrl: "http://10.0.0.5:8080" })
    ).toEqual({
      nodeId: "n1",
      transportDetails: {
        type: ESPTransportMode.local,
        metadata: {
          baseUrl: "http://10.0.0.5:8080",
          protocol: ESPLocalControlProtocol.rmakerLocalCtrl,
        },
      },
    });
  });

  it("carries the parsed cap TXT record as capabilities", () => {
    const data = toDiscoveredNodeData({
      nodeId: "n1",
      baseUrl: "http://x",
      txt: { node_id: "n1", cap: "local_ctrl,ch_resp" },
    });

    expect(data?.transportDetails.metadata).toEqual({
      baseUrl: "http://x",
      protocol: ESPLocalControlProtocol.rmakerLocalCtrl,
      capabilities: ["local_ctrl", "ch_resp"],
    });
  });

  it("tolerates whitespace in the cap record", () => {
    const data = toDiscoveredNodeData({
      nodeId: "n1",
      baseUrl: "http://x",
      txt: { cap: " local_ctrl , ch_resp " },
    });

    expect(data?.transportDetails.metadata.capabilities).toEqual([
      "local_ctrl",
      "ch_resp",
    ]);
  });

  it("skips a node advertising only challenge-response", () => {
    expect(
      toDiscoveredNodeData({
        nodeId: "n1",
        baseUrl: "http://x",
        txt: { cap: "ch_resp" },
      })
    ).toBeUndefined();
  });

  it("treats a missing cap record as control-capable", () => {
    const data = toDiscoveredNodeData({
      nodeId: "n1",
      baseUrl: "http://x",
      txt: { node_id: "n1" },
    });

    expect(data?.nodeId).toBe("n1");
    expect(data?.transportDetails.metadata.capabilities).toBeUndefined();
  });
});

describe("startLocalDiscovery", () => {
  beforeEach(() => {
    startDiscovery.mockReset();
    stopDiscovery.mockReset();
    // resetMocks: true wipes mockImplementation between tests; re-establish it.
    (ESPDiscoveryManager as unknown as jest.Mock).mockImplementation(() => ({
      startDiscovery,
      stopDiscovery,
    }));
  });

  it("forwards control-capable hits and drops the rest", () => {
    const onDiscovered = jest.fn();
    const teardown = startLocalDiscovery(onDiscovered);
    const emit = startDiscovery.mock.calls[0][0] as (
      info: Record<string, any>
    ) => void;

    emit({ nodeId: "n1", baseUrl: "http://a", txt: { cap: "local_ctrl" } });
    emit({ nodeId: "n2", baseUrl: "http://b", txt: { cap: "ch_resp" } });

    expect(onDiscovered).toHaveBeenCalledTimes(1);
    expect(onDiscovered.mock.calls[0][0].nodeId).toBe("n1");

    teardown.stop();
    expect(stopDiscovery).toHaveBeenCalled();
  });
});
