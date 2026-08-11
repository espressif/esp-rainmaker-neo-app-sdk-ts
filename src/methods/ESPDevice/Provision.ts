/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPProvResponse, ESPProvResponseStatus } from "../../types/provision";
import {
  ESPProvProgressMessages,
  Endpoint,
  ProvisionType,
} from "../../utils/constants";
import { ESPProvError } from "../../utils/error/ESPProvError";
import { ChallengeResponseHelper } from "../../services/ESPRMNeoHelpers/ChallengeResponseHelper";
import { uint8ArrayToBase64, base64ToUint8Array } from "../../services/ESPRMNeoHelpers/TransformEncoding";
import { InitiateNodeAssociationResponse } from "../../types/output";
import {
  DEFAULT_NODE_ONLINE_TIMEOUT_MS,
  waitForNodeOnline,
} from "../../utils/waitForNodeOnline";
import { Logger } from "../../utils/logger";

const logger = new Logger("Provision");

/** Optional step-6 settings for {@link ESPDevice.provision}. */
export interface ProvisionOptions {
  user?: ESPRMNeoUser;
  waitForOnline?: boolean;
  onlineTimeoutMs?: number;
}

function reportProgress(
  onProgress: ((message: ESPProvResponse) => void) | undefined,
  status: ESPProvResponseStatus,
  description: string
): void {
  onProgress?.({ status, description });
}

function validateProvisionOptions(options?: ProvisionOptions): void {
  if (options?.waitForOnline && !options.user) {
    throw new Error(
      "Provision options: user is required when waitForOnline is true"
    );
  }
}

/**
 * Augments the ESPDevice class with the `provision` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Provisions the device with WiFi credentials using challenge-response flow.
     *
     * @param ssid - The WiFi network SSID.
     * @param passphrase - The WiFi network password.
     * @param onProgress - A callback function to report progress.
     * @param groupId - The group ID for node association.
     * @param provisionType - The provisioning flow type. Default: ProvisionType.CHAL_RESP.
     * @param options - Optional step 6 (online wait via MQTT).
     * @returns A promise that resolves with the node ID when provisioning is complete.
     * @throws {Error} If provisioning fails at any stage.
     */
    provision(
      ssid: string,
      passphrase: string,
      onProgress: (message: ESPProvResponse) => void,
      groupId: string,
      provisionType?: string,
      options?: ProvisionOptions
    ): Promise<string>;
  }
}

ESPDevice.prototype.provision = async function (
  ssid: string,
  passphrase: string,
  onProgress: (message: ESPProvResponse) => void,
  groupId: string,
  provisionType: string = ProvisionType.CHAL_RESP,
  options?: ProvisionOptions
): Promise<string> {
  try {
    if (provisionType !== ProvisionType.CHAL_RESP) {
      throw new ESPProvError("INVALID_PROVISION_TYPE");
    }
    validateProvisionOptions(options);
    return await runChallengeResponseFlow(
      this,
      ssid,
      passphrase,
      groupId,
      onProgress,
      options
    );
  } catch (error) {
    logger.error(
      "Provision failed",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};

async function runChallengeResponseFlow(
  device: ESPDevice,
  ssid: string,
  passphrase: string,
  groupId: string,
  onProgress: (message: ESPProvResponse) => void,
  options?: ProvisionOptions
): Promise<string> {
  // 1. INITIATE (Server)
  reportProgress(
    onProgress,
    ESPProvResponseStatus.onProgress,
    ESPProvProgressMessages.INITIATING_NODE_ASSOCIATION
  );
  const initiateResponse = (await device.initiateUserNodeMapping(
    groupId,
    {}
  )) as InitiateNodeAssociationResponse;
  const { challenge, request_id: requestId } = initiateResponse;
  if (!challenge || !requestId) {
    throw new ESPProvError("INVALID_MAPPING_RESPONSE");
  }

  // 2. SEND CHALLENGE TO DEVICE
  reportProgress(
    onProgress,
    ESPProvResponseStatus.onProgress,
    ESPProvProgressMessages.SENDING_CHALLENGE_TO_DEVICE
  );
  const challengePayload = ChallengeResponseHelper.createChallengeRequest(
    challenge
  );
  const base64Payload = uint8ArrayToBase64(challengePayload);
  const responseStr = await device.sendData(
    Endpoint.CHALLENGE_RESPONSE,
    base64Payload
  );

  // 3. VALIDATE RESPONSE FORMAT
  const responseBytes = base64ToUint8Array(responseStr);
  const deviceResponse =
    ChallengeResponseHelper.parseDeviceResponse(responseBytes);
  if (
    !ChallengeResponseHelper.validateChallengeResponse(deviceResponse)
  ) {
    logger.error("Invalid device response", deviceResponse);
    throw new ESPProvError("INVALID_CHALLENGE_RESPONSE_FORMAT");
  }
  const { nodeId, signedChallenge } = deviceResponse;
  logger.debug("Parsed device response", {
    nodeId,
    signedChallengeLength: signedChallenge?.length,
  });

  // 4. VERIFY (Server)
  reportProgress(
    onProgress,
    ESPProvResponseStatus.onProgress,
    ESPProvProgressMessages.VERIFYING_NODE_ASSOCIATION
  );
  await device.verifyUserNodeMapping(groupId, requestId, {
    challenge_response: signedChallenge,
    node_id: nodeId,
  });

  // Association is verified and cannot be repeated; remember what step 6 needs
  // so `retryNetworkCredentials` can resume from the Wi-Fi step.
  device.provisionResumeState = {
    nodeId: nodeId!,
    groupId,
    options: options as Record<string, any> | undefined,
  };

  // 5. SET NETWORK CREDENTIALS
  reportProgress(
    onProgress,
    ESPProvResponseStatus.onProgress,
    ESPProvProgressMessages.SETTING_NETWORK_CREDENTIALS
  );
  await device.setNetworkCredentials(ssid, passphrase);

  const resolvedNodeId = nodeId!;

  // 6. Wait for cloud online (optional)
  if (options?.waitForOnline && options.user) {
    reportProgress(
      onProgress,
      ESPProvResponseStatus.onProgress,
      ESPProvProgressMessages.WAITING_FOR_ONLINE
    );
    await waitForNodeOnline({
      nodeId: resolvedNodeId,
      groupId,
      user: options.user as ESPRMNeoUser,
      timeoutMs: options.onlineTimeoutMs ?? DEFAULT_NODE_ONLINE_TIMEOUT_MS,
    });
  }

  // 7. Success
  reportProgress(
    onProgress,
    ESPProvResponseStatus.succeed,
    resolvedNodeId ?? ESPProvProgressMessages.DEVICE_PROVISIONED
  );
  return resolvedNodeId;
}
