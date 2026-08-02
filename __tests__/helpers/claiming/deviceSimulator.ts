/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A stand-in for the `rmaker_claim` endpoint on a device, driven by the message
 * type of each incoming request rather than a fixed call sequence — so tests fail
 * if the SDK reorders the exchange.
 */

import {
  RMakerClaimMsgType,
  RMakerClaimStatus,
} from "../../../src/proto/esp_rmaker_claim";
import { decodeRequest, deviceResponse } from "./protoWire";

export interface DeviceSimulatorOptions {
  /** Claim-start payload. Defaults to the firmware's `{ mac_addr, platform }`. */
  deviceInfo?: string;
  /** CSR payload the device streams back, fragmented at `fragmentSize`. */
  csrPayload?: string;
  /** Bytes per CSR fragment the device emits. */
  fragmentSize?: number;
  /** Status to answer a ClaimStart with. */
  startStatus?: RMakerClaimStatus;
  /** Status to answer CSR requests with. */
  csrStatus?: RMakerClaimStatus;
  /** Status to answer certificate fragments with. */
  verifyStatus?: RMakerClaimStatus;
  /** Reject the certificate fragment at this offset (others succeed). */
  rejectVerifyAtOffset?: number;
  /** Answer every CSR request with an empty payload, simulating a stall. */
  stallCsr?: boolean;
}

export interface DeviceSimulator {
  /** Wire as the provision adapter's `sendData`. */
  sendData: jest.Mock;
  /** Message types received, in order. */
  readonly received: RMakerClaimMsgType[];
  /** Certificate fragments received, in arrival order. */
  readonly certificateFragments: { offset: number; payload: string }[];
  /** The certificate payload as the device reassembled it. */
  reassembledCertificate(): string;
  /** Whether the SDK sent a ClaimAbort. */
  wasAborted(): boolean;
}

export const DEFAULT_DEVICE_INFO = JSON.stringify({
  mac_addr: "AABBCCDDEEFF",
  platform: "esp32c3",
});

export const DEFAULT_CSR_PAYLOAD = JSON.stringify({
  csr: "-----BEGIN CERTIFICATE REQUEST-----\nMIIB\n-----END CERTIFICATE REQUEST-----\n",
  send_mqtt_host: true,
});

export function createDeviceSimulator(
  options: DeviceSimulatorOptions = {}
): DeviceSimulator {
  const {
    deviceInfo = DEFAULT_DEVICE_INFO,
    csrPayload = DEFAULT_CSR_PAYLOAD,
    fragmentSize = 200,
    startStatus = RMakerClaimStatus.Success,
    csrStatus = RMakerClaimStatus.Success,
    verifyStatus = RMakerClaimStatus.Success,
    rejectVerifyAtOffset,
    stallCsr = false,
  } = options;

  const received: RMakerClaimMsgType[] = [];
  const certificateFragments: { offset: number; payload: string }[] = [];
  let csrOffset = 0;

  const sendData = jest.fn(
    async (_name: string, _endpoint: string, base64: string) => {
      const request = decodeRequest(base64);
      received.push(request.msg);

      switch (request.msg) {
        case RMakerClaimMsgType.TypeCmdClaimStart:
          return deviceResponse({
            msg: RMakerClaimMsgType.TypeRespClaimStart,
            status: startStatus,
            payload:
              startStatus === RMakerClaimStatus.Success ? deviceInfo : "",
          });

        case RMakerClaimMsgType.TypeCmdClaimInit: {
          if (csrStatus !== RMakerClaimStatus.Success) {
            return deviceResponse({
              msg: RMakerClaimMsgType.TypeRespClaimInit,
              status: csrStatus,
            });
          }
          if (stallCsr) {
            // Success, non-empty totalLen, but no forward progress.
            return deviceResponse({
              msg: RMakerClaimMsgType.TypeRespClaimInit,
              payload: "",
              offset: 0,
              totalLen: csrPayload.length,
            });
          }
          const fragment = csrPayload.slice(
            csrOffset,
            csrOffset + fragmentSize
          );
          const response = deviceResponse({
            msg: RMakerClaimMsgType.TypeRespClaimInit,
            payload: fragment,
            offset: csrOffset,
            totalLen: csrPayload.length,
          });
          csrOffset += fragment.length;
          return response;
        }

        case RMakerClaimMsgType.TypeCmdClaimVerify: {
          const rejected = request.offset === rejectVerifyAtOffset;
          if (!rejected) {
            certificateFragments.push({
              offset: request.offset,
              payload: request.payload,
            });
          }
          return deviceResponse({
            msg: RMakerClaimMsgType.TypeRespClaimVerify,
            status: rejected ? RMakerClaimStatus.InvalidParam : verifyStatus,
          });
        }

        case RMakerClaimMsgType.TypeCmdClaimAbort:
          return deviceResponse({ msg: RMakerClaimMsgType.TypeRespClaimAbort });

        default:
          return deviceResponse({ status: RMakerClaimStatus.InvalidState });
      }
    }
  );

  return {
    sendData,
    received,
    certificateFragments,
    reassembledCertificate: () =>
      [...certificateFragments]
        .sort((a, b) => a.offset - b.offset)
        .map((fragment) => fragment.payload)
        .join(""),
    wasAborted: () => received.includes(RMakerClaimMsgType.TypeCmdClaimAbort),
  };
}
