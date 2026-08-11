/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents the types of transport mechanisms available.
 */
enum ESPTransport {
  ble = "ble",
  softap = "softap",
}

/**
 * Represents the levels of security available.
 */
enum ESPSecurity {
  unsecure,
  secure,
  secure2,
}

/**
 * Represents the status of the connection.
 */
enum ESPConnectStatus {
  connected,
  failedToConnect,
  disconnected,
}

/**
 * Represents the status of the provisioning process.
 */
enum ESPProvisionStatus {
  success,
  failure,
}

/**
 * Represents a list of WiFi networks.
 */
interface ESPWifiList {
  ssid: string;
  rssi: number;
  auth: number;
  bssid?: string;
  channel?: number;
}

/**
 * Device descriptor returned by provisioning adapter (search/createESPDevice).
 * Pass an object implementing this interface to the ESPDevice constructor.
 */
interface ESPDeviceInterface {
  name: string;
  security: number;
  transport: string;
  connected?: boolean;
  username?: string;
  versionInfo?: { [key: string]: any }[];
  capabilities?: string[];
  advertisementData?: { [key: string]: any }[];
}

/**
 * Represents the methods available for provisioning a device.
 */
interface ESPProvisionAdapterInterface {
  searchESPDevices(
    devicePrefix: string,
    transport: ESPTransport
  ): Promise<ESPDeviceInterface[]>;
  stopESPDevicesSearch(): Promise<void>;
  createESPDevice(
    name: string,
    transport: string,
    security?: number,
    proofOfPossession?: string,
    softAPPassword?: string,
    username?: string
  ): Promise<ESPDeviceInterface>;
  connect(deviceName: string): Promise<number>;
  getDeviceCapabilities(deviceName: string): Promise<string[]>;
  getDeviceVersion(deviceName: string): Promise<{ [key: string]: any }>;
  setProofOfPossession(
    deviceName: string,
    proofOfPossession: string
  ): Promise<boolean>;
  initializeSession(deviceName: string): Promise<boolean>;
  scanWifiList(deviceName: string): Promise<ESPWifiList[]>;
  sendData(deviceName: string, endPoint: string, data: string): Promise<string>;
  provision(
    deviceName: string,
    ssid: string,
    passphrase: string
  ): Promise<ESPProvisionStatus>;
  /**
   * Clears the device's Wi-Fi state over the open provisioning session.
   * Requires an established session; the user-node association is left intact.
   *
   * Optional so that adapters written against an earlier SDK keep compiling;
   * `ESPDevice.resetWifiStatus` resolves `false` when it is absent.
   * @param deviceName - Name of the connected provisioning device.
   * @returns Promise resolving to `true` when the device acknowledged the reset.
   */
  resetWifiStatus?(deviceName: string): Promise<boolean>;
  disconnect(deviceName: string): Promise<void>;
}

/**
 * Represents the status of the provisioning response.
 */
enum ESPProvResponseStatus {
  onProgress = "onProgress",
  succeed = "succeed"
}

/**
 * Represents the response received after provisioning.
 */
interface ESPProvResponse {
  status: ESPProvResponseStatus;
  description?: string;
}

/**
 * Represents the status of a claiming operation.
 */
enum ESPClaimStatus {
  /** Claiming in progress */
  inProgress = "inProgress",
  /** Claiming succeeded */
  success = "success",
  /** Claiming failed */
  failed = "failed",
  /** Claiming was aborted */
  aborted = "aborted",
}

/**
 * Represents a claiming progress callback response.
 */
interface ESPClaimResponse {
  /** Current status of the claiming operation */
  status: ESPClaimStatus;
  /** Progress message description */
  message: string;
  /** Optional error information */
  error?: string;
}

/**
 * Callback type for claiming progress updates.
 */
type ESPClaimProgressCallback = (response: ESPClaimResponse) => void;

export {
  ESPTransport,
  ESPSecurity,
  ESPProvisionStatus,
  ESPConnectStatus,
  ESPWifiList,
  ESPDeviceInterface,
  ESPProvisionAdapterInterface,
  ESPProvResponse,
  ESPProvResponseStatus,
  ESPClaimStatus,
  ESPClaimResponse,
  ESPClaimProgressCallback,
};
