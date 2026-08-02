/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import type { ESPAPIResponse } from "../../src/types/output";
import { ESPTransportMode } from "../../src/types/transport";

// Capture ESPTransportManager construction + control its behavior.
const mockTransportState: {
  configs: any[];
  setParam: jest.Mock;
  getParams: jest.Mock;
} = {
  configs: [],
  setParam: jest.fn(),
  getParams: jest.fn(),
};

jest.mock("../../src/services/ESPTransport/ESPTransportManager", () => ({
  ESPTransportManager: class {
    constructor(config: any) {
      mockTransportState.configs.push(config);
    }
    setParam(...args: any[]) {
      return mockTransportState.setParam(...args);
    }
    getParams(...args: any[]) {
      return mockTransportState.getParams(...args);
    }
  },
}));

import { delegatedTransportHandler } from "../../src/services/ESPRMNeoHelpers/DelegatedTransportHandler";

const OK: ESPAPIResponse = { message: "ok", statusCode: 200 };

function makeNode(
  partial: Partial<ESPRMNeoNode> & { nodeId?: string } = {}
): ESPRMNeoNode {
  return {
    nodeId: "node-1",
    services: [],
    transportOrder: [ESPTransportMode.local, ESPTransportMode.mqtt],
    availableTransports: {
      [ESPTransportMode.local]: {
        type: ESPTransportMode.local,
        metadata: { baseUrl: "http://192.168.1.50" },
      },
      [ESPTransportMode.mqtt]: { type: ESPTransportMode.mqtt, metadata: {} },
    },
    ...partial,
  } as unknown as ESPRMNeoNode;
}

/** Mirrors how setValue/setParams invoke the handler. */
function run(node: ESPRMNeoNode, payload: Record<string, unknown> = {}) {
  return (delegatedTransportHandler<ESPAPIResponse>).call(node, (manager) =>
    manager.setParam(payload, node)
  );
}

describe("delegatedTransportHandler", () => {
  beforeEach(() => {
    mockTransportState.configs = [];
    mockTransportState.setParam.mockResolvedValue(OK);
    mockTransportState.getParams.mockResolvedValue({});
  });

  it("uses the first transport in order (local) when it succeeds", async () => {
    const res = await run(makeNode());
    expect(res).toBe(OK);
    expect(mockTransportState.configs).toHaveLength(1);
    expect(mockTransportState.configs[0].type).toBe(ESPTransportMode.local);
  });

  it("falls back to cloud when local fails", async () => {
    mockTransportState.setParam
      .mockRejectedValueOnce(new Error("LAN unreachable"))
      .mockResolvedValueOnce(OK);

    const res = await run(makeNode());
    expect(res).toBe(OK);
    expect(mockTransportState.configs.map((c) => c.type)).toEqual([
      ESPTransportMode.local,
      ESPTransportMode.mqtt,
    ]);
  });

  it("skips local (MISSING_BASE_URL) and uses cloud when no baseUrl", async () => {
    const node = makeNode({
      availableTransports: {
        [ESPTransportMode.local]: {
          type: ESPTransportMode.local,
          metadata: {},
        },
        [ESPTransportMode.mqtt]: {
          type: ESPTransportMode.mqtt,
          metadata: {},
        },
      },
    });
    const res = await run(node);
    expect(res).toBe(OK);
    // Only the cloud manager is constructed; local was skipped pre-construction.
    expect(mockTransportState.configs.map((c) => c.type)).toEqual([
      ESPTransportMode.mqtt,
    ]);
  });

  it("goes straight to cloud when local is not available", async () => {
    const node = makeNode({
      availableTransports: {
        [ESPTransportMode.mqtt]: {
          type: ESPTransportMode.mqtt,
          metadata: {},
        },
      },
    });
    const res = await run(node);
    expect(res).toBe(OK);
    expect(mockTransportState.configs.map((c) => c.type)).toEqual([
      ESPTransportMode.mqtt,
    ]);
  });

  it("respects a per-node transport order override (cloud first)", async () => {
    const node = makeNode({ transportOrder: [ESPTransportMode.mqtt] });
    await run(node);
    expect(mockTransportState.configs.map((c) => c.type)).toEqual([
      ESPTransportMode.mqtt,
    ]);
  });

  it("enriches local config metadata with creds read from the node", async () => {
    const node = makeNode({
      services: [
        {
          name: "svc1",
          type: "esp.service.local_control",
          params: [
            { id: "t", type: "esp.param.local_control_type", value: 1 },
            { id: "p", type: "esp.param.local_control_pop", value: "secret" },
          ],
        },
      ] as any,
    });
    await run(node);
    const localConfig = mockTransportState.configs.find(
      (c) => c.type === ESPTransportMode.local
    );
    expect(localConfig.metadata.securityType).toBe(1);
    expect(localConfig.metadata.pop).toBe("secret");
    // sec1 has no username.
    expect(localConfig.metadata.username).toBeUndefined();
  });

  it("enriches local config metadata with the username for sec2", async () => {
    const node = makeNode({
      services: [
        {
          name: "svc1",
          type: "esp.service.local_control",
          params: [
            { id: "t", type: "esp.param.local_control_type", value: 2 },
            { id: "p", type: "esp.param.local_control_pop", value: "pwd" },
            { id: "u", type: "esp.param.local_control_username", value: "user1" },
          ],
        },
      ] as any,
    });
    await run(node);
    const localConfig = mockTransportState.configs.find(
      (c) => c.type === ESPTransportMode.local
    );
    expect(localConfig.metadata.securityType).toBe(2);
    expect(localConfig.metadata.pop).toBe("pwd");
    expect(localConfig.metadata.username).toBe("user1");
  });

  it("throws NODE_UNREACHABLE when no transports are available", async () => {
    const node = makeNode({ availableTransports: {} });
    await expect(run(node)).rejects.toThrow(/unreachable/i);
    expect(mockTransportState.configs).toHaveLength(0);
  });

  it("prefers a custom transport manager over the built-in backend", async () => {
    const setParam = jest.fn().mockResolvedValue(OK);
    const node = makeNode({
      transportOrder: ["bluetooth", ESPTransportMode.mqtt],
      availableTransports: {
        bluetooth: { type: "bluetooth", metadata: {} },
        [ESPTransportMode.mqtt]: {
          type: ESPTransportMode.mqtt,
          metadata: {},
        },
      },
      customTransportManagers: {
        bluetooth: { setParam, getParams: jest.fn() },
      },
    });
    const res = await run(node);
    expect(res).toBe(OK);
    expect(setParam).toHaveBeenCalledTimes(1);
    expect(mockTransportState.configs).toHaveLength(0);
  });

  it("throws the last error when every transport fails", async () => {
    mockTransportState.setParam.mockRejectedValue(new Error("all down"));
    await expect(run(makeNode())).rejects.toThrow("all down");
  });
});
