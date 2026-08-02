/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import {
  ESPClaimProgressCallback,
  ESPClaimStatus,
} from "../../types/provision";
import {
  CLAIM_CSR_MAX_CHUNKS,
  CLAIM_DEVICE_CSR_KEYS,
  CLAIM_DEVICE_MAC_KEYS,
  CLAIM_MAX_FRAGMENT_SIZE,
  ClaimCapabilities,
  ClaimErrorCodes,
  ClaimProgressMessages,
  Endpoint,
} from "../../utils/constants";
import { ESPClaimError } from "../../utils/error/ESPClaimError";
import {
  ClaimDevicePayload,
  ClaimingHelper,
} from "../../services/ESPRMNeoHelpers/ClaimingHelper";
import { ClaimingProtoHelper } from "../../proto/esp_rmaker_claim";
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../../services/ESPRMNeoHelpers/TransformEncoding";
import { Logger } from "../../utils/logger";

const logger = new Logger("StartAssistedClaiming");

/**
 * Augments the ESPDevice class with the `startAssistedClaiming` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Starts the assisted claiming process.
     *
     * Flow:
     * 1. Send ClaimStart to device, which returns its device info
     * 2. Reserve a node ID for the device MAC (`POST /v1/claim/initiate`)
     * 3. Send ClaimInit with the cloud response to device
     * 4. Read the chunked CSR from device
     * 5. Exchange the CSR for a certificate (`POST /v1/claim/verify`)
     * 6. Stream the certificate response back to device
     *
     * @param onProgress - Callback for progress updates
     * @param claimCapability - Optional capability, e.g. `ClaimCapabilities.CAMERA_CLAIM`
     * @returns Promise that resolves when claiming is complete
     * @throws ESPClaimError if claiming fails at any step
     */
    startAssistedClaiming(
      onProgress?: ESPClaimProgressCallback,
      claimCapability?: ClaimCapabilities
    ): Promise<void>;
  }
}

function reportProgress(
  onProgress: ESPClaimProgressCallback | undefined,
  status: ESPClaimStatus,
  message: string,
  error?: string
): void {
  onProgress?.({ status, message, ...(error !== undefined ? { error } : {}) });
}

/** Correlation id so a single claim attempt can be stitched together in logs. */
function buildClaimId(deviceName: string): string {
  return `${deviceName}-${Date.now()}`;
}

/** Parses a device payload as JSON, or null when it is not a JSON object. */
function parseDevicePayload(raw: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, any>)
      : null;
  } catch {
    return null;
  }
}

/** Reads the first of `keys` present in `payload` as a non-empty string. */
function readFirstString(
  payload: Record<string, any> | null,
  keys: readonly string[]
): string | undefined {
  if (!payload) {
    return undefined;
  }
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Reads the device's claim-start payload. The MAC is returned separately because
 * the claiming service keys its reservation on it; the payload is returned whole
 * so every field the firmware sent is forwarded rather than cherry-picked.
 */
function readDeviceStartPayload(
  deviceInfo: string,
  claimId: string
): { macAddress: string; payload: Record<string, any> } {
  const payload = parseDevicePayload(deviceInfo);
  const macAddress = readFirstString(payload, CLAIM_DEVICE_MAC_KEYS);
  if (!macAddress) {
    logger.error("no MAC in device claim start response", {
      claimId,
      payloadKeys: payload ? Object.keys(payload) : null,
    });
    throw new ESPClaimError(ClaimErrorCodes.DEVICE_MAC_UNAVAILABLE);
  }
  return { macAddress, payload: payload ?? {} };
}

/**
 * Reads the device's claim payload for verify, accepting either a JSON wrapper
 * or a bare PEM block. Returned whole: the firmware sends request flags of its
 * own alongside the CSR, and extracting only `csr` would drop them.
 */
function readDeviceCsrPayload(
  csrData: string,
  claimId: string
): ClaimDevicePayload {
  const parsed = parseDevicePayload(csrData);
  const payload = parsed ?? { csr: csrData.trim() };
  const csr = readFirstString(payload, CLAIM_DEVICE_CSR_KEYS);

  if (!csr) {
    logger.error("no CSR in device claim payload", {
      claimId,
      payloadKeys: Object.keys(payload),
    });
    throw new ESPClaimError(ClaimErrorCodes.CSR_RETRIEVAL_FAILED);
  }
  // `csr` is set explicitly so a spelling variant still satisfies the contract,
  // while every other field the firmware sent is preserved.
  return { ...payload, csr };
}

/** Step 1 — ask the device to start claiming and return its device-info payload. */
async function requestDeviceInfo(
  device: ESPDevice,
  claimId: string
): Promise<string> {
  const request = ClaimingProtoHelper.createClaimStartRequest();
  const response = await device.sendData(
    Endpoint.RM_CLAIM,
    uint8ArrayToBase64(request)
  );

  const parsed = ClaimingProtoHelper.parseClaimResponse(
    base64ToUint8Array(response)
  );
  if (!ClaimingProtoHelper.isSuccess(parsed)) {
    logger.error("ClaimStart rejected by device", {
      claimId,
      status: ClaimingProtoHelper.getStatus(parsed),
    });
    throw new ESPClaimError(ClaimErrorCodes.CLAIM_START_FAILED);
  }

  const deviceInfo = ClaimingProtoHelper.extractPayloadString(parsed);
  if (!deviceInfo) {
    logger.error("ClaimStart returned empty device info", { claimId });
    throw new ESPClaimError(ClaimErrorCodes.CLAIM_START_FAILED);
  }
  return deviceInfo;
}

/**
 * Steps 3–4 — push the cloud init payload and reassemble the chunked CSR.
 *
 * The device owns `totalLen`; an empty ClaimInit means "send the next chunk".
 * Bounded by {@link CLAIM_CSR_MAX_CHUNKS} and a no-progress check so firmware
 * that reports Success without advancing cannot spin forever.
 */
async function retrieveCsr(
  device: ESPDevice,
  cloudInitResponse: string,
  claimId: string
): Promise<{ csrData: string; deviceChunkSize: number }> {
  const initRequest =
    ClaimingProtoHelper.createClaimInitRequest(cloudInitResponse);
  let currentResponse = await device.sendData(
    Endpoint.RM_CLAIM,
    uint8ArrayToBase64(initRequest)
  );

  let csrData = "";
  let deviceChunkSize = 0;
  let iterations = 0;

  for (;;) {
    iterations += 1;
    if (iterations > CLAIM_CSR_MAX_CHUNKS) {
      logger.error("CSR retrieval exceeded chunk budget", {
        claimId,
        iterations,
        received: csrData.length,
      });
      throw new ESPClaimError(ClaimErrorCodes.CSR_STALLED);
    }

    const parsed = ClaimingProtoHelper.parseClaimResponse(
      base64ToUint8Array(currentResponse)
    );
    if (!ClaimingProtoHelper.isSuccess(parsed)) {
      logger.error("device rejected CSR request", {
        claimId,
        iterations,
        status: ClaimingProtoHelper.getStatus(parsed),
      });
      throw new ESPClaimError(ClaimErrorCodes.CSR_RETRIEVAL_FAILED);
    }

    const chunk = ClaimingProtoHelper.extractPayloadString(parsed);
    const offset = ClaimingProtoHelper.getOffset(parsed);
    const totalLen = ClaimingProtoHelper.getTotalLen(parsed);

    if (offset === 0) {
      csrData = chunk;
      deviceChunkSize = chunk.length;
    } else {
      csrData += chunk;
    }

    // `totalLen` 0 with a non-empty chunk is the legitimate single-fragment case,
    // so completion is checked first and an actually-empty CSR is rejected rather
    // than POSTed to the cloud.
    if (csrData.length >= totalLen) {
      if (!csrData) {
        logger.error("device reported CSR complete but sent no data", {
          claimId,
          totalLen,
        });
        throw new ESPClaimError(ClaimErrorCodes.CSR_RETRIEVAL_FAILED);
      }
      return { csrData, deviceChunkSize };
    }

    // No forward progress means the device will never complete the transfer.
    if (!chunk.length) {
      logger.error("device returned an empty CSR chunk before completion", {
        claimId,
        accumulated: csrData.length,
        totalLen,
      });
      throw new ESPClaimError(ClaimErrorCodes.CSR_STALLED);
    }

    currentResponse = await device.sendData(
      Endpoint.RM_CLAIM,
      uint8ArrayToBase64(ClaimingProtoHelper.createClaimInitContinueRequest())
    );
  }
}

/** Step 6 — stream the certificate response back to the device in fragments. */
async function sendCertificate(
  device: ESPDevice,
  certificateData: string,
  deviceChunkSize: number,
  claimId: string
): Promise<void> {
  if (!certificateData) {
    logger.error("no certificate data to send", { claimId });
    throw new ESPClaimError(ClaimErrorCodes.CERTIFICATE_SEND_FAILED);
  }

  // 200 bytes is the protocol's fragment ceiling, not a hint: the device answers
  // an oversized fragment with NoMemory. A smaller device fragment size wins.
  const chunkSize =
    deviceChunkSize > 0
      ? Math.min(deviceChunkSize, CLAIM_MAX_FRAGMENT_SIZE)
      : CLAIM_MAX_FRAGMENT_SIZE;

  for (let offset = 0; offset < certificateData.length; offset += chunkSize) {
    const request = ClaimingProtoHelper.createClaimVerifyRequest(
      certificateData,
      offset,
      chunkSize
    );
    const response = await device.sendData(
      Endpoint.RM_CLAIM,
      uint8ArrayToBase64(request)
    );

    const parsed = ClaimingProtoHelper.parseClaimResponse(
      base64ToUint8Array(response)
    );
    if (!ClaimingProtoHelper.isSuccess(parsed)) {
      // The device validates the reassembled payload only on the final fragment,
      // so a rejection here can mean the payload was bad rather than the transfer.
      logger.error("device rejected certificate fragment", {
        claimId,
        status: ClaimingProtoHelper.getStatus(parsed),
        offset,
        chunkSize,
        totalBytes: certificateData.length,
      });
      throw new ESPClaimError(ClaimErrorCodes.CERTIFICATE_SEND_FAILED);
    }
  }
}

/** Best-effort abort so the device does not stay parked in a claiming session. */
async function abortClaiming(
  device: ESPDevice,
  claimId: string
): Promise<void> {
  try {
    await device.sendData(
      Endpoint.RM_CLAIM,
      uint8ArrayToBase64(ClaimingProtoHelper.createClaimAbortRequest())
    );
  } catch (error) {
    logger.warn("claim abort failed", {
      claimId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

ESPDevice.prototype.startAssistedClaiming = async function (
  onProgress?: ESPClaimProgressCallback,
  claimCapability?: ClaimCapabilities
): Promise<void> {
  const claimId = buildClaimId(this.name);
  const startedAt = Date.now();

  try {
    reportProgress(
      onProgress,
      ESPClaimStatus.inProgress,
      ClaimProgressMessages.CLAIM_STARTING
    );

    const deviceInfo = await requestDeviceInfo(this, claimId);
    reportProgress(
      onProgress,
      ESPClaimStatus.inProgress,
      ClaimProgressMessages.DEVICE_INFO_RECEIVED
    );

    // Reserve a node ID for this device's MAC. Idempotent, so a retry or a
    // factory-erased device resolves to the same node.
    const { macAddress, payload: startPayload } = readDeviceStartPayload(
      deviceInfo,
      claimId
    );
    reportProgress(
      onProgress,
      ESPClaimStatus.inProgress,
      ClaimProgressMessages.CLAIM_INIT_API
    );
    const initiateResponse = await ClaimingHelper.initiateClaim(
      macAddress,
      startPayload,
      claimId
    );

    // Forwarded whole; the device reads `node_id` from it.
    const cloudInitResponse = JSON.stringify(initiateResponse);

    reportProgress(
      onProgress,
      ESPClaimStatus.inProgress,
      ClaimProgressMessages.CSR_RETRIEVING
    );
    const { csrData, deviceChunkSize } = await retrieveCsr(
      this,
      cloudInitResponse,
      claimId
    );
    reportProgress(
      onProgress,
      ESPClaimStatus.inProgress,
      ClaimProgressMessages.CSR_RECEIVED
    );

    reportProgress(
      onProgress,
      ESPClaimStatus.inProgress,
      ClaimProgressMessages.CLAIM_VERIFY_API
    );
    const verifyResponse = await ClaimingHelper.verifyClaim(
      macAddress,
      readDeviceCsrPayload(csrData, claimId),
      claimCapability,
      claimId
    );
    reportProgress(
      onProgress,
      ESPClaimStatus.inProgress,
      ClaimProgressMessages.CERTIFICATE_RECEIVED
    );

    // Forwarded whole, so the device also gets `mqtt_host` and `ca_certificate`
    // alongside its leaf certificate.
    const certificateData = JSON.stringify(verifyResponse);

    reportProgress(
      onProgress,
      ESPClaimStatus.inProgress,
      ClaimProgressMessages.CERTIFICATE_SENDING
    );
    await sendCertificate(this, certificateData, deviceChunkSize, claimId);

    logger.info("assisted claiming succeeded", {
      claimId,
      nodeId: verifyResponse.node_id,
      mqttHost: verifyResponse.mqtt_host,
      elapsedMs: Date.now() - startedAt,
    });
    reportProgress(
      onProgress,
      ESPClaimStatus.success,
      ClaimProgressMessages.CLAIM_SUCCESS
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("assisted claiming failed", {
      claimId,
      code: error instanceof ESPClaimError ? error.code : undefined,
      elapsedMs: Date.now() - startedAt,
      error: message,
    });

    await abortClaiming(this, claimId);

    reportProgress(
      onProgress,
      ESPClaimStatus.failed,
      ClaimProgressMessages.CLAIM_FAILED,
      message
    );
    throw error;
  }
};
