/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Drives the transport against real `rmaker_local_ctrl` frames: device responses
 * come from `__tests__/helpers/localCtrl/protoWire` (an independent encoder) and
 * the requests the transport emits are decoded by the same helper, so the
 * fragmented pull is checked end to end rather than against a stubbed codec.
 */

jest.mock("../../src/ESPRMNeoBase", () => ({
  ESPRMNeoBase: { getLocalControlAdapter: jest.fn() },
}));

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { RMakerLocalCtrlDataType } from "../../src/proto/rmaker_local_ctrl";
import { ESPLocalControlTransport } from "../../src/services/ESPTransport/ESPLocalControlTransport";
import {
  ESPLocalControlProtocol,
  ESPTransportMode,
} from "../../src/types/transport";
import {
  RMAKER_LOCAL_CTRL_VERSION_KEY,
  RMakerLocalCtrlEndpoint,
} from "../../src/utils/constants";
import {
  decodeGetDataRequest,
  deviceFragment,
} from "../helpers/localCtrl/protoWire";

const getAdapter = ESPRMNeoBase.getLocalControlAdapter as jest.Mock;

/** Base64 of a UTF-8 string, as the native adapter returns it. */
function b64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

function makeAdapter(over: Record<string, jest.Mock> = {}) {
  return {
    isConnected: jest.fn().mockResolvedValue(true),
    connect: jest.fn().mockResolvedValue({}),
    sendData: jest.fn().mockResolvedValue(b64('{"status":"success"}')),
    ...over,
  };
}

/**
 * Adapter that serves `document` in `fragmentSize`-byte fragments, the way the
 * firmware's client-pull scheme does.
 */
function makeFragmentingAdapter(document: string, fragmentSize: number) {
  const bytes = new TextEncoder().encode(document);
  const sendData = jest.fn(
    async (_nodeId: string, _path: string, data: string) => {
      const { offset } = decodeGetDataRequest(data);
      // Raw byte slice: a fragment boundary may land mid-character.
      return deviceFragment({
        payload: bytes.slice(offset, offset + fragmentSize),
        offset,
        totalLen: bytes.length,
      });
    }
  );
  return makeAdapter({ sendData });
}

function transport(
  metadata: Record<string, unknown> = { baseUrl: "http://x" }
) {
  return new ESPLocalControlTransport({
    type: ESPTransportMode.local,
    metadata,
  });
}

describe("ESPLocalControlTransport", () => {
  beforeEach(() => {
    getAdapter.mockReset();
    getAdapter.mockReturnValue(makeAdapter());
  });

  describe("setParam", () => {
    it("posts the params as raw JSON to set_params", async () => {
      const adapter = makeAdapter();
      getAdapter.mockReturnValue(adapter);

      const res = await transport().setParam({
        node_id: "n1",
        payload: { Light: { Power: true } },
      });

      expect(adapter.sendData).toHaveBeenCalledWith(
        "n1",
        RMakerLocalCtrlEndpoint.SET_PARAMS,
        b64('{"Light":{"Power":true}}')
      );
      expect(res).toEqual({
        message: "Parameters updated successfully",
        statusCode: 200,
      });
    });

    it("rejects with the device description when the status is fail", async () => {
      getAdapter.mockReturnValue(
        makeAdapter({
          sendData: jest
            .fn()
            .mockResolvedValue(
              b64('{"status":"fail","description":"invalid param"}')
            ),
        })
      );

      await expect(
        transport().setParam({ node_id: "n1", payload: {} })
      ).rejects.toThrow("invalid param");
    });

    it("rejects a fail status that carries no description", async () => {
      getAdapter.mockReturnValue(
        makeAdapter({
          sendData: jest.fn().mockResolvedValue(b64('{"status":"fail"}')),
        })
      );

      await expect(
        transport().setParam({ node_id: "n1", payload: {} })
      ).rejects.toThrow(/Failed to set device params over local control/);
    });

    it("rejects when the device body is not JSON", async () => {
      getAdapter.mockReturnValue(
        makeAdapter({ sendData: jest.fn().mockResolvedValue(b64("<html>")) })
      );

      await expect(
        transport().setParam({ node_id: "n1", payload: {} })
      ).rejects.toThrow(/Unexpected set_params response/);
    });
  });

  describe("session", () => {
    it("connects with the rmaker_local_ctrl session endpoints (sec1)", async () => {
      const adapter = makeAdapter({
        isConnected: jest.fn().mockResolvedValue(false),
      });
      getAdapter.mockReturnValue(adapter);

      await transport({
        baseUrl: "http://x",
        securityType: 1,
        pop: "abcd",
      }).setParam({ node_id: "n1", payload: {} });

      expect(adapter.connect).toHaveBeenCalledWith(
        "n1",
        "http://x",
        1,
        "abcd",
        undefined,
        {
          protocol: ESPLocalControlProtocol.rmakerLocalCtrl,
          sessionPath: RMakerLocalCtrlEndpoint.SESSION,
          versionPath: RMakerLocalCtrlEndpoint.VERSION,
          versionKey: RMAKER_LOCAL_CTRL_VERSION_KEY,
        }
      );
    });

    it("forwards the sec2 username", async () => {
      const adapter = makeAdapter({
        isConnected: jest.fn().mockResolvedValue(false),
      });
      getAdapter.mockReturnValue(adapter);

      await transport({
        baseUrl: "http://x",
        securityType: 2,
        pop: "pwd",
        username: "wifiprov",
      }).setParam({ node_id: "n1", payload: {} });

      expect(adapter.connect).toHaveBeenCalledWith(
        "n1",
        "http://x",
        2,
        "pwd",
        "wifiprov",
        expect.objectContaining({
          sessionPath: RMakerLocalCtrlEndpoint.SESSION,
        })
      );
    });

    it("skips the handshake when a session already exists", async () => {
      const adapter = makeAdapter();
      getAdapter.mockReturnValue(adapter);

      await transport().setParam({ node_id: "n1", payload: {} });

      expect(adapter.connect).not.toHaveBeenCalled();
    });

    it("retries the handshake three times before failing", async () => {
      const adapter = makeAdapter({
        isConnected: jest.fn().mockResolvedValue(false),
        connect: jest.fn().mockRejectedValue(new Error("no route")),
      });
      getAdapter.mockReturnValue(adapter);

      await expect(
        transport().setParam({ node_id: "n1", payload: {} })
      ).rejects.toThrow(/Failed to connect after 3 attempts: no route/);
      expect(adapter.connect).toHaveBeenCalledTimes(3);
    });
  });

  describe("getParams", () => {
    it("reads a single-fragment document from get_params", async () => {
      const body = '{"Light":{"Power":true}}';
      const adapter = makeAdapter({
        sendData: jest
          .fn()
          .mockResolvedValue(deviceFragment({ payload: body })),
      });
      getAdapter.mockReturnValue(adapter);

      const params = await transport().getParams({ node_id: "n1" });

      expect(params).toEqual({ Light: { Power: true } });
      expect(adapter.sendData).toHaveBeenCalledTimes(1);
      const [nodeId, path, request] = adapter.sendData.mock.calls[0];
      expect(nodeId).toBe("n1");
      expect(path).toBe(RMakerLocalCtrlEndpoint.GET_PARAMS);
      expect(decodeGetDataRequest(request)).toMatchObject({
        dataType: RMakerLocalCtrlDataType.TypeParams,
        offset: 0,
      });
    });

    it("pulls 200-byte fragments by offset until the document is complete", async () => {
      // 3 devices × ~90 bytes each → several fragments at the firmware's size.
      const document = JSON.stringify({
        Light: { Power: true, Brightness: 75, Hue: 180, Saturation: 42 },
        Fan: { Power: false, Speed: 3, Direction: "clockwise" },
        Thermostat: { Setpoint: 22.5, Mode: "cool", FanMode: "auto" },
      });
      const adapter = makeFragmentingAdapter(document, 200);
      getAdapter.mockReturnValue(adapter);

      const params = await transport().getParams({ node_id: "n1" });

      expect(params).toEqual(JSON.parse(document));
      const byteLength = new TextEncoder().encode(document).length;
      expect(adapter.sendData).toHaveBeenCalledTimes(
        Math.ceil(byteLength / 200)
      );
      // Offsets advance by the served fragment length, starting at 0.
      const offsets = adapter.sendData.mock.calls.map(
        (call: unknown[]) => decodeGetDataRequest(call[2] as string).offset
      );
      expect(offsets[0]).toBe(0);
      expect(offsets).toEqual(
        offsets.map((_: number, i: number) => Math.min(i * 200, byteLength))
      );
    });

    it("reassembles a fragment boundary that splits a multi-byte character", async () => {
      // "é" is two bytes; a 5-byte fragment size splits it across fragments.
      const document = '{"n":"café-café"}';
      getAdapter.mockReturnValue(makeFragmentingAdapter(document, 5));

      await expect(transport().getParams({ node_id: "n1" })).resolves.toEqual(
        JSON.parse(document)
      );
    });

    it("rejects when the device reports a non-success status", async () => {
      getAdapter.mockReturnValue(
        makeAdapter({
          sendData: jest
            .fn()
            .mockResolvedValue(deviceFragment({ status: 1, omitBuf: true })),
        })
      );

      await expect(transport().getParams({ node_id: "n1" })).rejects.toThrow(
        /Device rejected the local-control read \(status Fail\)/
      );
    });

    it("rejects when the device answers a different offset", async () => {
      const sendData = jest
        .fn()
        .mockResolvedValueOnce(
          deviceFragment({ payload: "01234", offset: 0, totalLen: 10 })
        )
        .mockResolvedValueOnce(
          deviceFragment({ payload: "56789", offset: 9, totalLen: 10 })
        );
      getAdapter.mockReturnValue(makeAdapter({ sendData }));

      await expect(transport().getParams({ node_id: "n1" })).rejects.toThrow(
        /Device answered offset 9, expected 5/
      );
    });

    it("rejects rather than looping when a fragment makes no progress", async () => {
      const sendData = jest
        .fn()
        .mockResolvedValueOnce(
          deviceFragment({ payload: "abc", offset: 0, totalLen: 10 })
        )
        .mockResolvedValueOnce(
          deviceFragment({ payload: "", offset: 3, totalLen: 10 })
        );
      getAdapter.mockReturnValue(makeAdapter({ sendData }));

      await expect(transport().getParams({ node_id: "n1" })).rejects.toThrow(
        /empty fragment at offset 3 of 10/
      );
      expect(sendData).toHaveBeenCalledTimes(2);
    });

    it("returns an empty object for an empty document", async () => {
      getAdapter.mockReturnValue(
        makeAdapter({
          sendData: jest
            .fn()
            .mockResolvedValue(deviceFragment({ payload: "" })),
        })
      );

      await expect(transport().getParams({ node_id: "n1" })).resolves.toEqual(
        {}
      );
    });

    it("rejects on malformed JSON", async () => {
      getAdapter.mockReturnValue(
        makeAdapter({
          sendData: jest
            .fn()
            .mockResolvedValue(deviceFragment({ payload: "{not json" })),
        })
      );

      await expect(transport().getParams({ node_id: "n1" })).rejects.toThrow(
        /malformed JSON on get_params/
      );
    });
  });

  describe("getConfig", () => {
    it("reads the config document with DataType TypeConfig", async () => {
      const body = '{"node_id":"n1"}';
      const adapter = makeAdapter({
        sendData: jest
          .fn()
          .mockResolvedValue(deviceFragment({ payload: body })),
      });
      getAdapter.mockReturnValue(adapter);

      const config = await transport().getConfig("n1");

      expect(config).toEqual({ node_id: "n1" });
      const [, path, request] = adapter.sendData.mock.calls[0];
      expect(path).toBe(RMakerLocalCtrlEndpoint.GET_CONFIG);
      expect(decodeGetDataRequest(request).dataType).toBe(
        RMakerLocalCtrlDataType.TypeConfig
      );
    });
  });

  describe("serialization of fragmented reads", () => {
    /**
     * Mimics the firmware's single global transfer cache: an offset-0 request
     * regenerates it, and a fragment request for a document other than the
     * cached one fails exactly as the device would.
     */
    function makeCacheEmulatingAdapter(documents: Record<number, string>) {
      let cached: { dataType: number; bytes: Uint8Array } | undefined;

      const sendData = jest.fn(
        async (_nodeId: string, _path: string, data: string) => {
          const { dataType, offset } = decodeGetDataRequest(data);
          // Let both reads start before either finishes its first fragment.
          await new Promise((resolve) => setTimeout(resolve, 0));

          if (offset === 0) {
            cached = {
              dataType,
              bytes: new TextEncoder().encode(documents[dataType]),
            };
          } else if (!cached || cached.dataType !== dataType) {
            return deviceFragment({ status: 1, omitBuf: true });
          }

          const bytes = cached!.bytes;
          return deviceFragment({
            payload: bytes.slice(offset, offset + 8),
            offset,
            totalLen: bytes.length,
          });
        }
      );
      return makeAdapter({ sendData });
    }

    const PARAMS_DOC = '{"Light":{"Power":true},"Fan":{"Speed":3}}';
    const CONFIG_DOC = '{"node_id":"n1","info":{"name":"demo-node"}}';

    it("keeps concurrent getParams and getConfig on one node from clobbering", async () => {
      getAdapter.mockReturnValue(
        makeCacheEmulatingAdapter({ 0: PARAMS_DOC, 1: CONFIG_DOC })
      );
      const t = transport();

      const [params, config] = await Promise.all([
        t.getParams({ node_id: "n1" }),
        t.getConfig("n1"),
      ]);

      expect(params).toEqual(JSON.parse(PARAMS_DOC));
      expect(config).toEqual(JSON.parse(CONFIG_DOC));
    });

    it("serializes reads issued through separate transport instances", async () => {
      // delegatedTransportHandler builds a fresh transport per call, so the
      // queue has to live above the instance.
      getAdapter.mockReturnValue(
        makeCacheEmulatingAdapter({ 0: PARAMS_DOC, 1: CONFIG_DOC })
      );

      const [params, config] = await Promise.all([
        transport().getParams({ node_id: "n1" }),
        transport().getConfig("n1"),
      ]);

      expect(params).toEqual(JSON.parse(PARAMS_DOC));
      expect(config).toEqual(JSON.parse(CONFIG_DOC));
    });

    it("does not serialize reads across different nodes", async () => {
      const active = new Set<string>();
      let sawOverlap = false;
      const sendData = jest.fn(
        async (nodeId: string, _path: string, data: string) => {
          active.add(nodeId);
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (active.size > 1) sawOverlap = true;
          active.delete(nodeId);
          const { offset } = decodeGetDataRequest(data);
          const bytes = new TextEncoder().encode('{"a":1}');
          return deviceFragment({
            payload: bytes.slice(offset),
            offset,
            totalLen: bytes.length,
          });
        }
      );
      getAdapter.mockReturnValue(makeAdapter({ sendData }));

      await Promise.all([
        transport().getParams({ node_id: "n1" }),
        transport().getParams({ node_id: "n2" }),
      ]);

      expect(sawOverlap).toBe(true);
    });

    it("lets a later read proceed after an earlier one fails", async () => {
      const sendData = jest
        .fn()
        .mockRejectedValueOnce(new Error("socket died"))
        .mockResolvedValue(deviceFragment({ payload: '{"ok":true}' }));
      getAdapter.mockReturnValue(makeAdapter({ sendData }));

      const failed = transport().getParams({ node_id: "n1" });
      const queued = transport().getConfig("n1");

      await expect(failed).rejects.toThrow(/socket died/);
      // A wedged queue would leave this pending forever.
      await expect(queued).resolves.toEqual({ ok: true });
    });
  });

  it("throws when no local control adapter is configured", async () => {
    getAdapter.mockReturnValue(undefined);
    await expect(
      transport().setParam({ node_id: "n1", payload: {} })
    ).rejects.toThrow(/Local control adapter is not configured/);
  });
});
