/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal protobuf wire codec for the `rmaker_claim` frames, written independently
 * of `ClaimingProtoHelper` so tests exercise the SDK's codec against bytes it did
 * not produce itself.
 *
 * Field numbers, from the claim `def.proto`:
 * - `RMakerClaimPayload`: 1 = msg (varint), 10 = cmdPayload, 11 = respPayload
 * - `RespPayload`:        1 = status (varint), 2 = buf
 * - `PayloadBuf`:         1 = offset (varint), 2 = payload (bytes), 3 = totalLen (varint)
 */

import { RMakerClaimStatus } from "../../../src/proto/esp_rmaker_claim";

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

function encodePayloadBuf(
  offset: number,
  payload: string,
  totalLen: number
): number[] {
  const data = Array.from(new TextEncoder().encode(payload));
  return [
    tag(1, 0),
    ...varint(offset),
    ...lengthDelimited(2, data),
    tag(3, 0),
    ...varint(totalLen),
  ];
}

export interface DeviceResponseOptions {
  /** Response message type. Defaults to a ClaimStart response (1). */
  msg?: number;
  status?: RMakerClaimStatus;
  payload?: string;
  offset?: number;
  /** Defaults to the payload's byte length, i.e. a single complete fragment. */
  totalLen?: number;
}

/** Builds a base64 device response frame, as the provision adapter would return. */
export function deviceResponse(options: DeviceResponseOptions = {}): string {
  const {
    msg = 1,
    status = RMakerClaimStatus.Success,
    payload = "",
    offset = 0,
  } = options;
  const payloadBytes = new TextEncoder().encode(payload).length;
  const totalLen = options.totalLen ?? offset + payloadBytes;

  const respPayload = [
    tag(1, 0),
    ...varint(status),
    ...lengthDelimited(2, encodePayloadBuf(offset, payload, totalLen)),
  ];
  const frame = [
    tag(1, 0),
    ...varint(msg),
    ...lengthDelimited(11, respPayload),
  ];

  return Buffer.from(Uint8Array.from(frame)).toString("base64");
}

/** A single Success response carrying no payload — the device's ack shape. */
export function deviceAck(msg = 1): string {
  return deviceResponse({ msg });
}

/** Splits `text` into fragments and builds the device's chunked responses. */
export function deviceFragments(text: string, fragmentSize: number): string[] {
  const total = new TextEncoder().encode(text).length;
  const frames: string[] = [];
  for (let offset = 0; offset < text.length; offset += fragmentSize) {
    frames.push(
      deviceResponse({
        payload: text.slice(offset, offset + fragmentSize),
        offset,
        totalLen: total,
      })
    );
  }
  return frames;
}

/**
 * Decodes a request the SDK sent to the device, returning its msg type and the
 * `cmdPayload` (field 10) fragment.
 */
export function decodeRequest(base64: string): {
  msg: number;
  offset: number;
  payload: string;
  totalLen: number;
} {
  const data = new Uint8Array(Buffer.from(base64, "base64"));
  let index = 0;
  const result = { msg: 0, offset: 0, payload: "", totalLen: 0 };

  const readVarint = (): number => {
    let value = 0;
    let shift = 0;
    for (;;) {
      const byte = data[index++];
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return value;
  };

  while (index < data.length) {
    const fieldTag = data[index++];
    const fieldNumber = fieldTag >> 3;
    const wireType = fieldTag & 0x07;

    if (fieldNumber === 1 && wireType === 0) {
      result.msg = readVarint();
    } else if (fieldNumber === 10 && wireType === 2) {
      const length = readVarint();
      const body = data.slice(index, index + length);
      index += length;

      let inner = 0;
      const readInnerVarint = (): number => {
        let value = 0;
        let shift = 0;
        for (;;) {
          const byte = body[inner++];
          value |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }
        return value;
      };
      while (inner < body.length) {
        const innerTag = body[inner++];
        const innerField = innerTag >> 3;
        const innerWire = innerTag & 0x07;
        if (innerField === 1 && innerWire === 0) {
          result.offset = readInnerVarint();
        } else if (innerField === 2 && innerWire === 2) {
          const len = readInnerVarint();
          result.payload = new TextDecoder().decode(
            body.slice(inner, inner + len)
          );
          inner += len;
        } else if (innerField === 3 && innerWire === 0) {
          result.totalLen = readInnerVarint();
        } else if (innerWire === 2) {
          const len = readInnerVarint();
          inner += len;
        } else {
          readInnerVarint();
        }
      }
    } else if (wireType === 2) {
      const length = readVarint();
      index += length;
    } else {
      readVarint();
    }
  }

  return result;
}
