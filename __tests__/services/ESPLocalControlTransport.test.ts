/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// The generated protobuf relies on google-protobuf internals unavailable under
// jsdom; stub it so the transport's serialize/deserialize calls work.
jest.mock("../../src/proto/constants", () => ({ Status: { Success: 0 } }));
jest.mock("../../src/proto/esp_local_ctrl", () => {
  class LocalCtrlMessage {
    msg: unknown;
    cmd_set_prop_vals: unknown;
    cmd_get_prop_count: unknown;
    cmd_get_prop_vals: unknown;
    serialize() {
      return new Uint8Array([1, 2, 3]);
    }
    static deserialize = jest.fn();
  }
  return {
    LocalCtrlMessage,
    CmdSetPropertyValues: class {
      props: unknown[] = [];
    },
    CmdGetPropertyCount: class {},
    CmdGetPropertyValues: class {
      indices: number[] = [];
    },
    PropertyValue: class {
      index = 0;
      value: Uint8Array = new Uint8Array();
    },
    LocalCtrlMsgType: {
      TypeCmdGetPropertyCount: 0,
      TypeCmdGetPropertyValues: 4,
      TypeCmdSetPropertyValues: 6,
    },
  };
});
jest.mock("../../src/ESPRMNeoBase", () => ({
  ESPRMNeoBase: { getLocalControlAdapter: jest.fn() },
}));

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { LocalCtrlMessage } from "../../src/proto/esp_local_ctrl";
import { ESPLocalControlTransport } from "../../src/services/ESPTransport/ESPLocalControlTransport";
import { ESPTransportMode } from "../../src/types/transport";

const deserialize = LocalCtrlMessage.deserialize as unknown as jest.Mock;

function makeAdapter(over: Record<string, jest.Mock> = {}) {
  return {
    isConnected: jest.fn().mockResolvedValue(true),
    connect: jest.fn().mockResolvedValue({}),
    sendData: jest.fn().mockResolvedValue("AAAA"),
    ...over,
  };
}

function transport(metadata: Record<string, unknown> = { baseUrl: "http://x" }) {
  return new ESPLocalControlTransport({
    type: ESPTransportMode.local,
    metadata,
  });
}

const getAdapter = ESPRMNeoBase.getLocalControlAdapter as jest.Mock;

describe("ESPLocalControlTransport", () => {
  beforeEach(() => {
    getAdapter.mockReset();
    getAdapter.mockReturnValue(makeAdapter());
  });

  it("setParam serializes params and reports success on Status.Success", async () => {
    deserialize.mockReturnValue({ resp_set_prop_vals: { status: 0 } });
    const res = await transport().setParam({
      node_id: "n1",
      payload: { Switch: { Power: true } },
    });
    expect(res.statusCode).toBe(200);
    const adapter = getAdapter.mock.results[0].value;
    expect(adapter.sendData).toHaveBeenCalledWith("n1", expect.any(String), expect.any(String));
  });

  it("setParam throws when the device reports a non-success status", async () => {
    deserialize.mockReturnValue({ resp_set_prop_vals: { status: 5 } });
    await expect(
      transport().setParam({ node_id: "n1", payload: {} })
    ).rejects.toThrow(/Failed to set device params/);
  });

  it("connects first when the device is not already connected (sec1)", async () => {
    const adapter = makeAdapter({ isConnected: jest.fn().mockResolvedValue(false) });
    getAdapter.mockReturnValue(adapter);
    deserialize.mockReturnValue({ resp_set_prop_vals: { status: 0 } });

    await transport({ baseUrl: "http://x", securityType: 1, pop: "abcd" }).setParam({
      node_id: "n1",
      payload: {},
    });
    expect(adapter.connect).toHaveBeenCalledWith("n1", "http://x", 1, "abcd", undefined);
  });

  it("forwards the username to connect for sec2", async () => {
    const adapter = makeAdapter({ isConnected: jest.fn().mockResolvedValue(false) });
    getAdapter.mockReturnValue(adapter);
    deserialize.mockReturnValue({ resp_set_prop_vals: { status: 0 } });

    await transport({
      baseUrl: "http://x",
      securityType: 2,
      pop: "pwd",
      username: "user1",
    }).setParam({ node_id: "n1", payload: {} });

    expect(adapter.connect).toHaveBeenCalledWith(
      "n1",
      "http://x",
      2,
      "pwd",
      "user1"
    );
  });

  it("getParams reads the property count then each property value", async () => {
    deserialize
      .mockReturnValueOnce({ resp_get_prop_count: { status: 0, count: 1 } })
      .mockReturnValueOnce({
        resp_get_prop_vals: {
          status: 0,
          props: [
            {
              name: "Switch",
              value: new TextEncoder().encode(JSON.stringify({ Power: true })),
            },
          ],
        },
      });

    const res = await transport().getParams({ node_id: "n1" });
    expect(res).toEqual({ Switch: { Power: true } });
  });

  it("throws when no local control adapter is configured", async () => {
    getAdapter.mockReturnValue(undefined);
    await expect(
      transport().setParam({ node_id: "n1", payload: {} })
    ).rejects.toThrow(/adapter is not configured/);
  });
});
