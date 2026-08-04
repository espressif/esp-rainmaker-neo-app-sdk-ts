/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { rmaker_misc } from "../../proto/esp_rmaker_chal_resp";
import { Endpoint } from "../../utils/constants";
/**
 * Response from parsing device challenge-response.
 */
export interface DeviceChallengeResponse {
  success: boolean;
  nodeId?: string;
  signedChallenge?: string;
  error?: string;
}

/**
 * Challenge-response helper for ESP RainMaker provisioning flow.
 * Handles protobuf creation, device communication, and response parsing.
 */
export class ChallengeResponseHelper {
  /**
   * Creates a challenge request payload using the esp_rmaker_chal_resp proto.
   */
  static createChallengeRequest(challenge: string): Uint8Array {
    const challengeBytes = new TextEncoder().encode(challenge);

    // Use the correct constructor pattern from generated proto
    const cmdPayload = new rmaker_misc.CmdCRPayload({
      payload: challengeBytes,
    });

    const miscPayload = new rmaker_misc.RMakerMiscPayload({
      msg: rmaker_misc.RMakerMiscMsgType.TypeCmdChallengeResponse,
      status: rmaker_misc.RMakerMiscStatus.Success,
      cmdChallengeResponsePayload: cmdPayload,
    });

    // Use the serialize method from the generated class
    return miscPayload.serialize();
  }

  /**
   * Parses the device response from challenge-response protocol.
   */
  static parseDeviceResponse(responseData: Uint8Array): DeviceChallengeResponse {
    try {
      const response = rmaker_misc.RMakerMiscPayload.deserialize(responseData);

      if (response.status !== rmaker_misc.RMakerMiscStatus.Success) {
        return {
          success: false,
          error: "Device returned unsuccessful status",
        };
      }

      const resp = response.respChallengeResponsePayload;

      if (!resp) {
        return {
          success: false,
          error: "Missing challenge response payload",
        };
      }

      if (!resp.payload || !resp.node_id) {
        return {
          success: false,
          error: "Invalid response payload: missing payload or nodeId",
        };
      }

      const signedChallenge = Array.from(resp.payload)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return {
        success: true,
        nodeId: resp.node_id,
        signedChallenge,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to parse device response",
      };
    }
  }

  /**
   * Validates challenge response format (success, nodeId, signedChallenge as hex).
   */
  static validateChallengeResponse(response: DeviceChallengeResponse): boolean {
    if (!response.success || !response.nodeId || !response.signedChallenge) {
      return false;
    }
    const hexRegex = /^[0-9a-fA-F]+$/;
    return hexRegex.test(response.signedChallenge);
  }

  /**
   * Returns true when device version info advertises challenge-response (`ch_resp`).
   */
  static checkChallengeResponseCapability(versionInfo: {
    [key: string]: unknown;
  }): boolean {
    try {
      const rmakerExtra = versionInfo?.rmaker_extra;
      if (!rmakerExtra || typeof rmakerExtra !== "object") {
        return false;
      }

      const extraCapabilities = (rmakerExtra as { cap?: unknown }).cap;
      if (!Array.isArray(extraCapabilities)) {
        return false;
      }

      return extraCapabilities.includes(Endpoint.CHALLENGE_RESPONSE);
    } catch {
      return false;
    }
  }
}
