/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Codec tests for the hand-rolled `rmaker_claim` protobuf. Device frames are
 * built by `__tests__/helpers/claiming/protoWire`, an independent encoder, so a
 * bug shared between the SDK's encoder and parser cannot hide.
 */

import {
  ClaimingProtoHelper,
  RMakerClaimMsgType,
  RMakerClaimStatus,
} from "../../src/proto/esp_rmaker_claim";
import { decodeRequest, deviceResponse } from "../helpers/claiming/protoWire";

const CLAIM_MAX_FRAGMENT_SIZE = 200;

function parse(base64: string) {
  return ClaimingProtoHelper.parseClaimResponse(
    new Uint8Array(Buffer.from(base64, "base64"))
  );
}

describe("ClaimingProtoHelper — requests", () => {
  it("tags each command with its own message type", () => {
    expect(
      decodeRequest(
        Buffer.from(ClaimingProtoHelper.createClaimStartRequest()).toString(
          "base64"
        )
      ).msg
    ).toBe(RMakerClaimMsgType.TypeCmdClaimStart);

    expect(
      decodeRequest(
        Buffer.from(ClaimingProtoHelper.createClaimInitRequest("{}")).toString(
          "base64"
        )
      ).msg
    ).toBe(RMakerClaimMsgType.TypeCmdClaimInit);

    expect(
      decodeRequest(
        Buffer.from(
          ClaimingProtoHelper.createClaimVerifyRequest("cert", 0, 200)
        ).toString("base64")
      ).msg
    ).toBe(RMakerClaimMsgType.TypeCmdClaimVerify);

    expect(
      decodeRequest(
        Buffer.from(ClaimingProtoHelper.createClaimAbortRequest()).toString(
          "base64"
        )
      ).msg
    ).toBe(RMakerClaimMsgType.TypeCmdClaimAbort);
  });

  it("carries the cloud init payload verbatim", () => {
    const payload = JSON.stringify({ node_id: "A1B2C3D4E5F60718" });
    const request = ClaimingProtoHelper.createClaimInitRequest(payload);

    const decoded = decodeRequest(Buffer.from(request).toString("base64"));
    expect(decoded.payload).toBe(payload);
    expect(decoded.totalLen).toBe(payload.length);
  });

  it("sends an empty continue request, which asks for the next fragment", () => {
    const decoded = decodeRequest(
      Buffer.from(
        ClaimingProtoHelper.createClaimInitContinueRequest()
      ).toString("base64")
    );
    expect(decoded.payload).toBe("");
    expect(decoded.msg).toBe(RMakerClaimMsgType.TypeCmdClaimInit);
  });

  describe("certificate fragmentation", () => {
    // 3 full fragments plus a short tail, so the final-fragment clamp is covered.
    const certificate = "x".repeat(CLAIM_MAX_FRAGMENT_SIZE * 3 + 37);

    it("declares the full length on every fragment", () => {
      for (
        let offset = 0;
        offset < certificate.length;
        offset += CLAIM_MAX_FRAGMENT_SIZE
      ) {
        const decoded = decodeRequest(
          Buffer.from(
            ClaimingProtoHelper.createClaimVerifyRequest(
              certificate,
              offset,
              CLAIM_MAX_FRAGMENT_SIZE
            )
          ).toString("base64")
        );
        expect(decoded.totalLen).toBe(certificate.length);
        expect(decoded.offset).toBe(offset);
      }
    });

    it("clamps the final fragment instead of reading past the end", () => {
      const lastOffset = CLAIM_MAX_FRAGMENT_SIZE * 3;
      const decoded = decodeRequest(
        Buffer.from(
          ClaimingProtoHelper.createClaimVerifyRequest(
            certificate,
            lastOffset,
            CLAIM_MAX_FRAGMENT_SIZE
          )
        ).toString("base64")
      );
      expect(decoded.payload).toHaveLength(37);
    });

    it("reassembles to the original when fragments are concatenated", () => {
      let reassembled = "";
      for (
        let offset = 0;
        offset < certificate.length;
        offset += CLAIM_MAX_FRAGMENT_SIZE
      ) {
        reassembled += decodeRequest(
          Buffer.from(
            ClaimingProtoHelper.createClaimVerifyRequest(
              certificate,
              offset,
              CLAIM_MAX_FRAGMENT_SIZE
            )
          ).toString("base64")
        ).payload;
      }
      expect(reassembled).toBe(certificate);
    });
  });
});

describe("ClaimingProtoHelper — responses", () => {
  it("reads payload, offset and totalLen from a device frame", () => {
    const parsed = parse(
      deviceResponse({ payload: "chunk-two", offset: 200, totalLen: 512 })
    );

    expect(ClaimingProtoHelper.extractPayloadString(parsed)).toBe("chunk-two");
    expect(ClaimingProtoHelper.getOffset(parsed)).toBe(200);
    expect(ClaimingProtoHelper.getTotalLen(parsed)).toBe(512);
  });

  it("treats an absent status as Success, per proto3 defaults", () => {
    // Encoded with status 0, which proto3 omits from the wire.
    const parsed = parse(deviceResponse({ status: RMakerClaimStatus.Success }));
    expect(ClaimingProtoHelper.isSuccess(parsed)).toBe(true);
    expect(ClaimingProtoHelper.getStatus(parsed)).toBe("Success");
  });

  it.each([
    [RMakerClaimStatus.Fail, "Fail"],
    [RMakerClaimStatus.InvalidParam, "InvalidParam"],
    [RMakerClaimStatus.InvalidState, "InvalidState"],
    [RMakerClaimStatus.NoMemory, "NoMemory"],
  ])("reports %s as a failure named %s", (status, name) => {
    const parsed = parse(deviceResponse({ status }));
    expect(ClaimingProtoHelper.isSuccess(parsed)).toBe(false);
    expect(ClaimingProtoHelper.getStatus(parsed)).toBe(name);
  });

  it("handles a frame with no respPayload without throwing", () => {
    const parsed = ClaimingProtoHelper.parseClaimResponse(
      Uint8Array.from([0x08, 0x01])
    );
    expect(ClaimingProtoHelper.extractPayloadString(parsed)).toBe("");
    expect(ClaimingProtoHelper.getTotalLen(parsed)).toBe(0);
    expect(ClaimingProtoHelper.getStatus(parsed)).toBe("Unknown");
  });

  it("skips unknown fields rather than mis-parsing the frame", () => {
    // A varint field 7 injected ahead of the fields the parser cares about.
    const frame = Buffer.from(
      Uint8Array.from([0x38, 0x2a, 0x08, 0x03])
    ).toString("base64");
    expect(parse(frame).msg).toBe(3);
  });

  it("round-trips multi-byte varints past the single-byte boundary", () => {
    const parsed = parse(
      deviceResponse({ payload: "a", offset: 300, totalLen: 100000 })
    );
    expect(ClaimingProtoHelper.getOffset(parsed)).toBe(300);
    expect(ClaimingProtoHelper.getTotalLen(parsed)).toBe(100000);
  });
});
