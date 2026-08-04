/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { isValidUrl, isNonEmptyString, isValidObject } from "./validators";
import { ESPRMNeoBaseConfig } from "../../types/input";
import { ESPConfigError } from "../error/Error";
import { ConfigErrorCodes } from "../constants";
import { configErrorMessages } from "../error/errorMessages";
import { ESPStorageAdapter } from "../../types/storage";
import { MQTTTransport } from "../../services/interfaces/MQTTTransport";
import { ESPProvisionAdapterInterface } from "../../types/provision";
import { ESPLocalControlAdapterInterface } from "../../types/localControl";
import { ESPLocalDiscoveryAdapterInterface } from "../../types/discovery";

type ConfigErrorCode = keyof typeof configErrorMessages;

/** Methods every custom storage adapter must implement. */
const STORAGE_ADAPTER_METHODS = [
  "setItem",
  "getItem",
  "removeItem",
  "clear",
] as const;

/** Required methods for an MQTT transport (`once` is optional per interface). */
const MQTT_ADAPTER_METHODS = [
  "connect",
  "disconnect",
  "isConnected",
  "publish",
  "subscribe",
  "unsubscribe",
] as const;

/** Required methods for a provisioning adapter. */
const PROVISION_ADAPTER_METHODS = [
  "searchESPDevices",
  "stopESPDevicesSearch",
  "createESPDevice",
  "connect",
  "getDeviceCapabilities",
  "getDeviceVersion",
  "setProofOfPossession",
  "initializeSession",
  "scanWifiList",
  "sendData",
  "provision",
  "disconnect",
] as const;

/** Required methods for a local control adapter. */
const LOCAL_CONTROL_ADAPTER_METHODS = [
  "isConnected",
  "connect",
  "sendData",
] as const;

/** Required methods for a local discovery adapter. */
const LOCAL_DISCOVERY_ADAPTER_METHODS = [
  "startDiscovery",
  "stopDiscovery",
] as const;

/**
 * A class that validates configuration objects for the ESP RainMaker Neo SDK.
 *
 * This class provides methods to ensure that the provided configuration
 * adheres to the required structure and rules for URLs, versions, and other fields.
 */
export class ConfigValidator {
  /**
   * Validates the given authentication configuration.
   *
   * @param config - The authentication configuration object to validate.
   * @throws {ESPConfigError} If the configuration is invalid.
   */
  static validateConfig(config: ESPRMNeoBaseConfig): void {
    ConfigValidator.validateConfigObject(config);
    ConfigValidator.validateBaseUrl(config.baseUrl);
    ConfigValidator.validateUserApiBase(config.userApiBase);
    ConfigValidator.validateRegion(config.awsRegion);
    ConfigValidator.validateIotEndpoint(config.iotEndpoint);
    ConfigValidator.validateCustomStorageAdapter(config.customStorageAdapter);
    ConfigValidator.validateMQTTAdapter(config.mqttAdapter);
    ConfigValidator.validateProvisionAdapter(config.provisionAdapter);
    ConfigValidator.validateLocalControlAdapter(config.localControlAdapter);
    ConfigValidator.validateLocalDiscoveryAdapter(config.localDiscoveryAdapter);
  }

  /**
   * Validates that the provided configuration object is valid.
   *
   * @param config - The configuration object to validate.
   * @throws {ESPConfigError} If the configuration object is invalid.
   */
  private static validateConfigObject(config: ESPRMNeoBaseConfig): void {
    if (!isValidObject(config)) {
      throw new ESPConfigError(ConfigErrorCodes.INVALID_CONFIG_OBJECT);
    }
  }

  /**
   * Validates the base URL of the configuration.
   *
   * @param baseUrl - The base URL to validate.
   * @throws {ESPConfigError} If the base URL is invalid or empty.
   */
  private static validateBaseUrl(baseUrl: string): void {
    if (!isNonEmptyString(baseUrl) || !isValidUrl(baseUrl)) {
      throw new ESPConfigError(ConfigErrorCodes.INVALID_BASE_URL);
    }
  }

  /**
   * Validates the User/auth API base URL of the configuration.
   *
   * @param userApiBase - The User API base URL to validate.
   * @throws {ESPConfigError} If the User API base URL is invalid or empty.
   */
  private static validateUserApiBase(userApiBase: string): void {
    if (!isNonEmptyString(userApiBase) || !isValidUrl(userApiBase)) {
      throw new ESPConfigError(ConfigErrorCodes.INVALID_USER_API_BASE);
    }
  }

  /**
   * Validates the AWS region.
   *
   * @param region - The AWS region to validate.
   * @throws {ESPConfigError} If the region is invalid or empty.
   */
  private static validateRegion(region: string): void {
    if (!isNonEmptyString(region)) {
      throw new ESPConfigError(ConfigErrorCodes.INVALID_REGION);
    }
  }

  /**
   * Validates the IoT endpoint (used for MQTT and SigV4-signed connections).
   * Accepts either a hostname (e.g. `xxxxx-ats.iot.region.amazonaws.com`) or a
   * full `wss://…/mqtt` URL; both forms are normalised downstream.
   *
   * @param iotEndpoint - The IoT endpoint string to validate.
   * @throws {ESPConfigError} If the endpoint is missing or empty.
   */
  private static validateIotEndpoint(iotEndpoint: string): void {
    if (!isNonEmptyString(iotEndpoint)) {
      throw new ESPConfigError(ConfigErrorCodes.INVALID_IOT_ENDPOINT);
    }
  }

  /**
   * Validates that an adapter is an object and implements every method in
   * {@link requiredMethods}. Throws with {@link errorCode} on the first
   * missing method.
   */
  private static validateAdapterShape(
    adapter: unknown,
    requiredMethods: readonly string[],
    errorCode: ConfigErrorCode
  ): void {
    if (!isValidObject(adapter)) {
      throw new ESPConfigError(errorCode);
    }
    const record = adapter as Record<string, unknown>;
    for (const method of requiredMethods) {
      if (typeof record[method] !== "function") {
        throw new ESPConfigError(errorCode);
      }
    }
  }

  /**
   * Validates the custom storage adapter if provided.
   *
   * @param adapter - The custom storage adapter to validate. Optional.
   * @throws {ESPConfigError} If the adapter is provided but does not implement
   *   the {@link ESPStorageAdapter} contract.
   */
  private static validateCustomStorageAdapter(
    adapter?: ESPStorageAdapter
  ): void {
    if (adapter === undefined) return;
    ConfigValidator.validateAdapterShape(
      adapter,
      STORAGE_ADAPTER_METHODS,
      ConfigErrorCodes.INVALID_STORAGE_ADAPTER
    );
  }

  /**
   * Validates the MQTT adapter if provided.
   *
   * @param adapter - The MQTT adapter to validate. Optional.
   * @throws {ESPConfigError} If the adapter is provided but does not implement
   *   the {@link MQTTTransport} contract.
   */
  private static validateMQTTAdapter(adapter?: MQTTTransport): void {
    if (adapter === undefined) return;
    ConfigValidator.validateAdapterShape(
      adapter,
      MQTT_ADAPTER_METHODS,
      ConfigErrorCodes.INVALID_MQTT_ADAPTER
    );
  }

  /**
   * Validates the provisioning adapter if provided.
   *
   * @param adapter - The provisioning adapter to validate. Optional.
   * @throws {ESPConfigError} If the adapter is provided but does not implement
   *   the {@link ESPProvisionAdapterInterface} contract.
   */
  private static validateProvisionAdapter(
    adapter?: ESPProvisionAdapterInterface
  ): void {
    if (adapter === undefined) return;
    ConfigValidator.validateAdapterShape(
      adapter,
      PROVISION_ADAPTER_METHODS,
      ConfigErrorCodes.INVALID_PROVISION_ADAPTER
    );
  }

  /**
   * Validates the local control adapter if provided.
   *
   * @param adapter - The local control adapter to validate. Optional.
   * @throws {ESPConfigError} If the adapter is provided but does not implement
   *   the {@link ESPLocalControlAdapterInterface} contract.
   */
  private static validateLocalControlAdapter(
    adapter?: ESPLocalControlAdapterInterface
  ): void {
    if (adapter === undefined) return;
    ConfigValidator.validateAdapterShape(
      adapter,
      LOCAL_CONTROL_ADAPTER_METHODS,
      ConfigErrorCodes.INVALID_LOCAL_CONTROL_ADAPTER
    );
  }

  /**
   * Validates the local discovery adapter if provided.
   *
   * @param adapter - The local discovery adapter to validate. Optional.
   * @throws {ESPConfigError} If the adapter is provided but does not implement
   *   the {@link ESPLocalDiscoveryAdapterInterface} contract.
   */
  private static validateLocalDiscoveryAdapter(
    adapter?: ESPLocalDiscoveryAdapterInterface
  ): void {
    if (adapter === undefined) return;
    ConfigValidator.validateAdapterShape(
      adapter,
      LOCAL_DISCOVERY_ADAPTER_METHODS,
      ConfigErrorCodes.INVALID_LOCAL_DISCOVERY_ADAPTER
    );
  }
}
