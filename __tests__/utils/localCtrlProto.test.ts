/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Codec tests for the hand-rolled `rmaker_local_ctrl` protobuf. Device frames
 * are built by `__tests__/helpers/localCtrl/protoWire`, an independent encoder,
 * so a bug shared between the SDK's encoder and parser cannot hide.
 */

import {
  RMakerLocalCtrlDataType,
  RMakerLocalCtrlMsgType,
  RMakerLocalCtrlProtoHelper,
  RMakerLocalCtrlStatus,
} from "../../src/proto/rmaker_local_ctrl";
import {
  decodeGetDataRequest,
  deviceFragment,
} from "../helpers/localCtrl/protoWire";

function parse(base64: string) {
  return RMakerLocalCtrlProtoHelper.parseGetDataResponse(
    new Uint8Array(Buffer.from(base64, "base64"))
  );
}

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

describe("RMakerLocalCtrlProtoHelper — requests", () => {
  it("encodes the exact wire bytes for a params read at offset 0", () => {
    const request = RMakerLocalCtrlProtoHelper.createGetDataRequest(
      RMakerLocalCtrlDataType.TypeParams,
      0
    );

    // msg=0 (field 1 varint), cmdGetData (field 10, len 4) { DataType=0, Offset=0 }
    expect(Array.from(request)).toEqual([
      0x08, 0x00, 0x52, 0x04, 0x08, 0x00, 0x10, 0x00,
    ]);
  });

  it("encodes a multi-byte offset as a varint", () => {
    const request = RMakerLocalCtrlProtoHelper.createGetDataRequest(
      RMakerLocalCtrlDataType.TypeConfig,
      200
    );

    // Offset 200 → 0xC8 0x01; DataType 1 → TypeConfig.
    expect(Array.from(request)).toEqual([
      0x08, 0x00, 0x52, 0x05, 0x08, 0x01, 0x10, 0xc8, 0x01,
    ]);
  });

  it("round-trips through the independent decoder", () => {
    const params = decodeGetDataRequest(
      b64(
        RMakerLocalCtrlProtoHelper.createGetDataRequest(
          RMakerLocalCtrlDataType.TypeParams,
          400
        )
      )
    );
    expect(params).toEqual({
      msg: RMakerLocalCtrlMsgType.TypeCmdGetData,
      dataType: RMakerLocalCtrlDataType.TypeParams,
      offset: 400,
    });

    const config = decodeGetDataRequest(
      b64(
        RMakerLocalCtrlProtoHelper.createGetDataRequest(
          RMakerLocalCtrlDataType.TypeConfig,
          16384
        )
      )
    );
    expect(config).toEqual({
      msg: RMakerLocalCtrlMsgType.TypeCmdGetData,
      dataType: RMakerLocalCtrlDataType.TypeConfig,
      offset: 16384,
    });
  });
});

describe("RMakerLocalCtrlProtoHelper — responses", () => {
  it("parses a complete single-fragment response", () => {
    const body = '{"Light":{"Power":true}}';
    const parsed = parse(deviceFragment({ payload: body }));

    expect(parsed.msg).toBe(RMakerLocalCtrlMsgType.TypeRespGetData);
    expect(RMakerLocalCtrlProtoHelper.isSuccess(parsed)).toBe(true);
    expect(RMakerLocalCtrlProtoHelper.getOffset(parsed)).toBe(0);
    expect(RMakerLocalCtrlProtoHelper.getTotalLen(parsed)).toBe(body.length);
    expect(
      new TextDecoder().decode(RMakerLocalCtrlProtoHelper.getPayload(parsed))
    ).toBe(body);
  });

  it("parses a mid-document fragment with a large offset", () => {
    const parsed = parse(
      deviceFragment({ payload: "tail", offset: 400, totalLen: 404 })
    );

    expect(RMakerLocalCtrlProtoHelper.getOffset(parsed)).toBe(400);
    expect(RMakerLocalCtrlProtoHelper.getTotalLen(parsed)).toBe(404);
    expect(
      new TextDecoder().decode(RMakerLocalCtrlProtoHelper.getPayload(parsed))
    ).toBe("tail");
  });

  it("preserves multi-byte UTF-8 across the fragment boundary", () => {
    // A 200-byte fragment can split a multi-byte character; the codec must hand
    // back raw bytes so the caller can join fragments before decoding.
    const text = "café";
    const encoded = new TextEncoder().encode(text);
    const parsed = parse(
      deviceFragment({ payload: text, totalLen: encoded.length })
    );

    expect(Array.from(RMakerLocalCtrlProtoHelper.getPayload(parsed))).toEqual(
      Array.from(encoded)
    );
  });

  it("reports each failure status by name", () => {
    for (const status of [
      RMakerLocalCtrlStatus.Fail,
      RMakerLocalCtrlStatus.InvalidParam,
      RMakerLocalCtrlStatus.NoMemory,
    ]) {
      const parsed = parse(deviceFragment({ status, omitBuf: true }));
      expect(RMakerLocalCtrlProtoHelper.isSuccess(parsed)).toBe(false);
      expect(RMakerLocalCtrlProtoHelper.getStatus(parsed)).toBe(
        RMakerLocalCtrlStatus[status]
      );
    }
  });

  it("defaults an absent Buf to empty values", () => {
    const parsed = parse(deviceFragment({ omitBuf: true }));

    expect(RMakerLocalCtrlProtoHelper.getOffset(parsed)).toBe(0);
    expect(RMakerLocalCtrlProtoHelper.getTotalLen(parsed)).toBe(0);
    expect(RMakerLocalCtrlProtoHelper.getPayload(parsed)).toHaveLength(0);
  });

  it("reports Unknown for a response carrying no respGetData", () => {
    const parsed = RMakerLocalCtrlProtoHelper.parseGetDataResponse(
      new Uint8Array([0x08, 0x01])
    );

    expect(RMakerLocalCtrlProtoHelper.isSuccess(parsed)).toBe(false);
    expect(RMakerLocalCtrlProtoHelper.getStatus(parsed)).toBe("Unknown");
  });

  it("skips unknown fields a newer firmware may add", () => {
    const body = '{"ok":true}';
    const base = Array.from(
      Buffer.from(deviceFragment({ payload: body }), "base64")
    );
    // Append an unknown varint field 7 and an unknown length-delimited field 9.
    const withUnknown = new Uint8Array([
      ...base,
      0x38,
      0x2a,
      0x4a,
      0x02,
      0xaa,
      0xbb,
    ]);

    const parsed = RMakerLocalCtrlProtoHelper.parseGetDataResponse(withUnknown);

    expect(RMakerLocalCtrlProtoHelper.isSuccess(parsed)).toBe(true);
    expect(
      new TextDecoder().decode(RMakerLocalCtrlProtoHelper.getPayload(parsed))
    ).toBe(body);
  });
});
