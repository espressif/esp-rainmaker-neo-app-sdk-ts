/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal protobuf wire codec for `rmaker_local_ctrl` frames, written
 * independently of {@link RMakerLocalCtrlProtoHelper} so tests exercise the
 * SDK's codec against bytes it did not produce itself.
 *
 * Field numbers, from `local_ctrl.proto`:
 * - `RMakerLocalCtrlPayload`: 1 = msg (varint), 10 = cmdGetData, 11 = respGetData
 * - `CmdGetData`:  1 = DataType (varint), 2 = Offset (varint),
 *                  3 = Timestamp (varint), 4 = HasTimestamp (varint)
 * - `RespGetData`: 1 = Status (varint), 2 = Buf
 * - `PayloadBuf`:  1 = Offset (varint), 2 = Payload (bytes), 3 = TotalLen (varint)
 */

import {
  RMakerLocalCtrlDataType,
  RMakerLocalCtrlMsgType,
  RMakerLocalCtrlStatus,
} from "../../../src/proto/rmaker_local_ctrl";

function varint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 127) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining & 0x7f);
  return bytes;
}

function tag(fieldNumber: number, wireType: number): number {
  return (fieldNumber << 3) | wireType;
}

function lengthDelimited(fieldNumber: number, body: number[]): number[] {
  return [tag(fieldNumber, 2), ...varint(body.length), ...body];
}

export interface DeviceFragmentOptions {
  /** Response message type. Defaults to a `RespGetData` (1). */
  msg?: number;
  status?: RMakerLocalCtrlStatus;
  /**
   * Fragment contents. Defaults to an empty fragment. Pass raw bytes when the
   * fragment boundary may split a multi-byte character — decoding such a slice
   * to a string first would replace the partial character with U+FFFD.
   */
  payload?: string | Uint8Array;
  offset?: number;
  /** Defaults to the payload's byte length, i.e. a single complete fragment. */
  totalLen?: number;
  /** Omit the `Buf` field entirely (device reporting a bare status). */
  omitBuf?: boolean;
}

/**
 * Builds the base64 a device would return for one `get_params`/`get_config`
 * fragment.
 */
export function deviceFragment(options: DeviceFragmentOptions = {}): string {
  const {
    msg = RMakerLocalCtrlMsgType.TypeRespGetData,
    status = RMakerLocalCtrlStatus.Success,
    payload = "",
    offset = 0,
    omitBuf = false,
  } = options;

  const data = Array.from(
    typeof payload === "string" ? new TextEncoder().encode(payload) : payload
  );
  const totalLen = options.totalLen ?? data.length;

  const respGetData: number[] = [tag(1, 0), ...varint(status)];
  if (!omitBuf) {
    const buf = [
      tag(1, 0),
      ...varint(offset),
      ...lengthDelimited(2, data),
      tag(3, 0),
      ...varint(totalLen),
    ];
    respGetData.push(...lengthDelimited(2, buf));
  }

  const frame = [
    tag(1, 0),
    ...varint(msg),
    ...lengthDelimited(11, respGetData),
  ];
  return Buffer.from(frame).toString("base64");
}

export interface DecodedGetDataRequest {
  msg: number;
  dataType: number;
  offset: number;
}

/**
 * Decodes a `CmdGetData` request produced by the SDK.
 */
export function decodeGetDataRequest(base64: string): DecodedGetDataRequest {
  const bytes = Array.from(Buffer.from(base64, "base64"));
  const result: DecodedGetDataRequest = {
    msg: RMakerLocalCtrlMsgType.TypeCmdGetData,
    dataType: RMakerLocalCtrlDataType.TypeParams,
    offset: 0,
  };

  let index = 0;
  const readVarint = (): number => {
    let value = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = bytes[index++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    return value;
  };

  while (index < bytes.length) {
    const fieldTag = bytes[index++];
    const fieldNumber = fieldTag >> 3;
    const wireType = fieldTag & 0x07;

    if (fieldNumber === 1 && wireType === 0) {
      result.msg = readVarint();
      continue;
    }
    if (fieldNumber === 10 && wireType === 2) {
      const length = readVarint();
      const end = index + length;
      while (index < end) {
        const innerTag = bytes[index++];
        const innerField = innerTag >> 3;
        if (innerField === 1) result.dataType = readVarint();
        else if (innerField === 2) result.offset = readVarint();
        else readVarint();
      }
      continue;
    }
    if (wireType === 0) readVarint();
    else if (wireType === 2) index += readVarint();
    else index++;
  }

  return result;
}
