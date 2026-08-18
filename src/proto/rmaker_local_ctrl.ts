/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Codec for the `rmaker_local_ctrl` endpoint protocol, mirroring the firmware's
 * `local_ctrl.proto` schema.
 *
 * Hand-rolled like {@link ClaimingProtoHelper} rather than generated: the
 * schema is small, and generated `google-protobuf` modules cannot be pulled
 * into a downstream Metro/RN bundle (see the note in `utils/export.ts`).
 *
 * Field numbers are the wire contract with deployed firmware — treat them as
 * frozen:
 * - `RMakerLocalCtrlPayload`: 1 = msg (varint), 10 = cmdGetData, 11 = respGetData
 * - `CmdGetData`:  1 = DataType (varint), 2 = Offset (varint),
 *                  3 = Timestamp (varint), 4 = HasTimestamp (varint)
 * - `RespGetData`: 1 = Status (varint), 2 = Buf
 * - `PayloadBuf`:  1 = Offset (varint), 2 = Payload (bytes), 3 = TotalLen (varint)
 *
 * `Timestamp` / `HasTimestamp` are reserved for a future signed-response
 * extension and are ignored by current firmware, so the encoder omits them.
 *
 * Only `get_params` / `get_config` use this schema; `set_params` carries raw
 * JSON on the wire.
 */

/**
 * Status returned by the device for a data read.
 */
export enum RMakerLocalCtrlStatus {
  Success = 0,
  Fail = 1,
  InvalidParam = 2,
  NoMemory = 3,
}

/**
 * Selects which document a read targets.
 */
export enum RMakerLocalCtrlDataType {
  /** The node's params JSON, as served by `get_params`. */
  TypeParams = 0,
  /** The node's config JSON, as served by `get_config`. */
  TypeConfig = 1,
}

/**
 * Message type discriminator carried on `RMakerLocalCtrlPayload.msg`.
 */
export enum RMakerLocalCtrlMsgType {
  TypeCmdGetData = 0,
  TypeRespGetData = 1,
}

/**
 * One fragment of a larger document.
 */
export interface PayloadBuf {
  /** Byte offset of this fragment within the document. */
  offset: number;
  /** Fragment bytes (up to 200 per response). */
  payload: Uint8Array;
  /** Full document length in bytes. */
  totalLen: number;
}

/**
 * Device response to a data read.
 */
export interface RespGetData {
  /** Read status. */
  status: RMakerLocalCtrlStatus;
  /** Fragment carried by this response. */
  buf?: PayloadBuf;
}

/**
 * Envelope exchanged on the `get_params` / `get_config` endpoints.
 */
export interface RMakerLocalCtrlPayload {
  /** Message type. */
  msg: RMakerLocalCtrlMsgType;
  /** Response payload (device → app). */
  respGetData?: RespGetData;
}

/** Tag bytes written by the request encoder: `(fieldNumber << 3) | wireType`. */
const TAG_FIELD_1_VARINT = 0x08;
const TAG_FIELD_2_VARINT = 0x10;
const TAG_FIELD_10_BYTES = 0x52;

const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_BYTES = 2;

/**
 * Encoder/decoder for `rmaker_local_ctrl` frames.
 */
export class RMakerLocalCtrlProtoHelper {
  /**
   * Builds a `CmdGetData` request for one fragment.
   *
   * An `offset` of 0 makes the device (re)generate and cache the document;
   * subsequent offsets are served from that cache.
   *
   * @param dataType - Document to read.
   * @param offset - Byte offset to read from.
   * @returns The serialized request.
   */
  static createGetDataRequest(
    dataType: RMakerLocalCtrlDataType,
    offset: number
  ): Uint8Array {
    const cmdGetData = this.concat([
      // Both fields are written explicitly, including their proto3 zero values,
      // matching how the reference clients frame this command.
      new Uint8Array([TAG_FIELD_1_VARINT]),
      this.encodeVarint(dataType),
      new Uint8Array([TAG_FIELD_2_VARINT]),
      this.encodeVarint(offset),
    ]);

    return this.concat([
      new Uint8Array([TAG_FIELD_1_VARINT]),
      this.encodeVarint(RMakerLocalCtrlMsgType.TypeCmdGetData),
      new Uint8Array([TAG_FIELD_10_BYTES]),
      this.encodeVarint(cmdGetData.length),
      cmdGetData,
    ]);
  }

  /**
   * Parses a `RespGetData` frame from the device.
   *
   * @param data - Raw response bytes.
   * @returns The parsed payload. Absent fields keep their proto3 defaults.
   */
  static parseGetDataResponse(data: Uint8Array): RMakerLocalCtrlPayload {
    const result: RMakerLocalCtrlPayload = {
      msg: RMakerLocalCtrlMsgType.TypeCmdGetData,
    };

    let index = 0;
    while (index < data.length) {
      const tag = data[index++];
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x07;

      if (fieldNumber === 1 && wireType === WIRE_TYPE_VARINT) {
        const { value, newIndex } = this.readVarint(data, index);
        result.msg = value as RMakerLocalCtrlMsgType;
        index = newIndex;
        continue;
      }
      if (fieldNumber === 11 && wireType === WIRE_TYPE_BYTES) {
        const { value: length, newIndex } = this.readVarint(data, index);
        result.respGetData = this.parseRespGetData(
          data.slice(newIndex, newIndex + length)
        );
        index = newIndex + length;
        continue;
      }
      index = this.skipField(data, index, wireType);
    }

    return result;
  }

  /**
   * Whether the device reported a successful read.
   *
   * @param response - Parsed response.
   */
  static isSuccess(response: RMakerLocalCtrlPayload): boolean {
    return response.respGetData?.status === RMakerLocalCtrlStatus.Success;
  }

  /**
   * Returns the device's status as its enum name, for diagnostics.
   *
   * @param response - Parsed response.
   * @returns The status name, or `"Unknown"` when absent.
   */
  static getStatus(response: RMakerLocalCtrlPayload): string {
    const status = response.respGetData?.status;
    return status === undefined
      ? "Unknown"
      : (RMakerLocalCtrlStatus[status] ?? `Unknown(${status})`);
  }

  /**
   * Offset the device answered with, which must match the requested offset.
   *
   * @param response - Parsed response.
   */
  static getOffset(response: RMakerLocalCtrlPayload): number {
    return response.respGetData?.buf?.offset ?? 0;
  }

  /**
   * Full document length reported by the device.
   *
   * @param response - Parsed response.
   */
  static getTotalLen(response: RMakerLocalCtrlPayload): number {
    return response.respGetData?.buf?.totalLen ?? 0;
  }

  /**
   * Fragment bytes carried by the response.
   *
   * @param response - Parsed response.
   */
  static getPayload(response: RMakerLocalCtrlPayload): Uint8Array {
    return response.respGetData?.buf?.payload ?? new Uint8Array(0);
  }

  // Private helper methods

  private static concat(parts: Uint8Array[]): Uint8Array {
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const part of parts) {
      result.set(part, pos);
      pos += part.length;
    }
    return result;
  }

  private static encodeVarint(value: number): Uint8Array {
    const bytes: number[] = [];
    let remaining = value;
    while (remaining > 127) {
      bytes.push((remaining & 0x7f) | 0x80);
      remaining >>>= 7;
    }
    bytes.push(remaining & 0x7f);
    return new Uint8Array(bytes);
  }

  private static readVarint(
    data: Uint8Array,
    index: number
  ): { value: number; newIndex: number } {
    let value = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = data[index++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);

    return { value, newIndex: index };
  }

  /** Advances past a field this codec does not read. */
  private static skipField(
    data: Uint8Array,
    index: number,
    wireType: number
  ): number {
    if (wireType === WIRE_TYPE_VARINT) {
      return this.readVarint(data, index).newIndex;
    }
    if (wireType === WIRE_TYPE_BYTES) {
      const { value: length, newIndex } = this.readVarint(data, index);
      return newIndex + length;
    }
    return index + 1;
  }

  private static parseRespGetData(data: Uint8Array): RespGetData {
    // In proto3 an absent status defaults to 0, i.e. Success.
    const result: RespGetData = { status: RMakerLocalCtrlStatus.Success };

    let index = 0;
    while (index < data.length) {
      const tag = data[index++];
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x07;

      if (fieldNumber === 1 && wireType === WIRE_TYPE_VARINT) {
        const { value, newIndex } = this.readVarint(data, index);
        result.status = value as RMakerLocalCtrlStatus;
        index = newIndex;
        continue;
      }
      if (fieldNumber === 2 && wireType === WIRE_TYPE_BYTES) {
        const { value: length, newIndex } = this.readVarint(data, index);
        result.buf = this.parsePayloadBuf(
          data.slice(newIndex, newIndex + length)
        );
        index = newIndex + length;
        continue;
      }
      index = this.skipField(data, index, wireType);
    }

    return result;
  }

  private static parsePayloadBuf(data: Uint8Array): PayloadBuf {
    const result: PayloadBuf = {
      offset: 0,
      payload: new Uint8Array(0),
      totalLen: 0,
    };

    let index = 0;
    while (index < data.length) {
      const tag = data[index++];
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x07;

      if (fieldNumber === 1 && wireType === WIRE_TYPE_VARINT) {
        const { value, newIndex } = this.readVarint(data, index);
        result.offset = value;
        index = newIndex;
        continue;
      }
      if (fieldNumber === 2 && wireType === WIRE_TYPE_BYTES) {
        const { value: length, newIndex } = this.readVarint(data, index);
        result.payload = data.slice(newIndex, newIndex + length);
        index = newIndex + length;
        continue;
      }
      if (fieldNumber === 3 && wireType === WIRE_TYPE_VARINT) {
        const { value, newIndex } = this.readVarint(data, index);
        result.totalLen = value;
        index = newIndex;
        continue;
      }
      index = this.skipField(data, index, wireType);
    }

    return result;
  }
}
