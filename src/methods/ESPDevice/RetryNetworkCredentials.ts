/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../ESPDevice";
import { ESPRMNeoUser } from "../../ESPRMNeoUser";
import { ESPProvResponse, ESPProvResponseStatus } from "../../types/provision";
import { ESPProvProgressMessages } from "../../utils/constants";
import { ESPProvError } from "../../utils/error/ESPProvError";
import {
  DEFAULT_NODE_ONLINE_TIMEOUT_MS,
  waitForNodeOnline,
} from "../../utils/waitForNodeOnline";
import { Logger } from "../../utils/logger";

const logger = new Logger("RetryNetworkCredentials");

/**
 * Augments the ESPDevice class with the `retryNetworkCredentials` method.
 */
declare module "../../ESPDevice" {
  interface ESPDevice {
    /**
     * Re-sends Wi-Fi credentials after `resetWifiStatus`, resuming the flow the
     * first attempt started rather than repeating its association.
     *
     * Sending credentials alone is not enough: the online wait and the success
     * report follow them and need the node id the association produced, which
     * only this SDK holds.
     * @param ssid - The SSID, unchanged from the first attempt.
     * @param passphrase - The corrected Wi-Fi password.
     * @param onProgress - Progress callback; emits the same messages as `provision`.
     * @returns A promise resolving to the node id.
     * @throws {ESPProvError} When no association has completed on this device yet.
     */
    retryNetworkCredentials(
      ssid: string,
      passphrase: string,
      onProgress: (message: ESPProvResponse) => void
    ): Promise<string>;
  }
}

ESPDevice.prototype.retryNetworkCredentials = async function (
  ssid: string,
  passphrase: string,
  onProgress: (message: ESPProvResponse) => void
): Promise<string> {
  const resumeState = this.provisionResumeState;
  if (!resumeState) {
    logger.error(
      `Retry refused for "${this.name}": no association recorded, nothing to resume`
    );
    throw new ESPProvError("FAILED_PROV");
  }


  onProgress({
    status: ESPProvResponseStatus.onProgress,
    description: ESPProvProgressMessages.SETTING_NETWORK_CREDENTIALS,
  });
  await this.setNetworkCredentials(ssid, passphrase);

  const options = resumeState.options;
  if (options?.waitForOnline && options.user) {
    onProgress({
      status: ESPProvResponseStatus.onProgress,
      description: ESPProvProgressMessages.WAITING_FOR_ONLINE,
    });
    await waitForNodeOnline({
      nodeId: resumeState.nodeId,
      groupId: resumeState.groupId,
      user: options.user as ESPRMNeoUser,
      timeoutMs: options.onlineTimeoutMs ?? DEFAULT_NODE_ONLINE_TIMEOUT_MS,
    });
  }

  onProgress({
    status: ESPProvResponseStatus.succeed,
    description: resumeState.nodeId ?? ESPProvProgressMessages.DEVICE_PROVISIONED,
  });
  return resumeState.nodeId;
};
