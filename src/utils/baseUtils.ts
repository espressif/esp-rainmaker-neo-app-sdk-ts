/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Internal helpers for {@link ESPRMNeoBase} configure / dispose / validation.
 *
 * Not part of the public SDK barrel — used only by the base facade so
 * lifecycle orchestration stays out of the class body.
 */

import { ESPRMNeoAuth } from "../ESPRMNeoAuth";
import { ESPRMNeoBaseConfig } from "../types/input";
import { ESPStorageAdapter } from "../types/storage";
import { ESPProvisionAdapterInterface } from "../types/provision";
import type { ESPLocalControlAdapterInterface } from "../types/localControl";
import type { ESPLocalDiscoveryAdapterInterface } from "../types/discovery";
import {
  ESPRMNeoStorage,
  _resetESPRMNeoStorageForTests,
} from "../services/ESPRMNeoStorage/ESPRMNeoStorage";
import {
  initializeAPIManager,
  _resetAPIManagerForTests,
} from "../services/ESPRMNeoAPIManager";
import {
  initializeSigV4APIManager,
  _resetSigV4APIManagerForTests,
} from "../services/ESPSigV4APIManager";
import { ESPRMNeoMqtt } from "../services/ESPRMNeoMqtt/ESPRMNeoMqtt";
import { NodeMQTTOrchestrator } from "../services/NodeMQTTOrchestrator";
import { ESPRMNeoSubscriptionManager } from "../services/ESPRMNeoSubscriptionManager";
import { registerMqttChannelIfNeeded } from "../services/ESPRMNeoHelpers/ChannelRegistration";
import {
  DEFAULT_TRANSPORT_ORDER,
  ESPTransportMode,
} from "../types/transport";
import { ConfigErrorCodes } from "./constants";
import { ESPConfigError } from "./error/Error";
import { configErrorMessages } from "./error/errorMessages";
import { Logger } from "./logger";

const logger = new Logger("baseUtils");

/**
 * {@link ConfigErrorCodes} values accepted by {@link assertAdapterProvided}.
 */
export type AdapterConfigErrorCode =
  | typeof ConfigErrorCodes.INVALID_STORAGE_ADAPTER
  | typeof ConfigErrorCodes.INVALID_PROVISION_ADAPTER
  | typeof ConfigErrorCodes.INVALID_LOCAL_CONTROL_ADAPTER
  | typeof ConfigErrorCodes.INVALID_LOCAL_DISCOVERY_ADAPTER
  | typeof ConfigErrorCodes.INVALID_MQTT_ADAPTER;

/**
 * Stable log message strings for base SDK lifecycle events.
 */
const BaseLogMessages = {
  RESOLVE_USER_API_BASE: "Resolved User API base",
  EXTRACT_ADAPTERS: "Extracted adapters from config",
  MQTT_SKIP: "MQTT adapter not configured; skipping MQTT init",
  MQTT_INIT: "Initializing MQTT transport and NodeMQTTOrchestrator",
  API_STACK_INIT: "Initializing storage and API managers",
  SUBSCRIPTION_CREATE: "Creating subscription manager",
  SUBSCRIPTION_MQTT_REGISTER: "Registering default MQTT subscription channel",
  AUTH_CREATE: "Creating auth instance",
  DISPOSE_PEERS: "Disposing peer singletons",
  DISPOSE_SUBSCRIPTION_FAILED: "Subscription manager dispose failed",
  MQTT_CLEAR_SKIPPED: "ESPRMNeoMqtt.clear skipped",
  ORCHESTRATOR_CLEAR_SKIPPED: "NodeMQTTOrchestrator.clear skipped",
  TRANSPORT_ORDER_INVALID: "Invalid transport order provided",
  SDK_NOT_INITIALIZED: "SDK not initialized",
  ADAPTER_INVALID: "Invalid adapter provided",
  CONFIG_SUMMARY: "Configuration summary",
} as const;

/**
 * Optional adapters taken from {@link ESPRMNeoBaseConfig} at configure time.
 */
export interface ESPRMNeoBaseAdapters {
  /** Custom key/value storage; when omitted, storage uses its default adapter. */
  storage?: ESPStorageAdapter;
  /** SoftAP / BLE provisioning implementation supplied by the host app. */
  provision?: ESPProvisionAdapterInterface;
  /** LAN local-control transport implementation. */
  localControl?: ESPLocalControlAdapterInterface;
  /** LAN / mDNS discovery implementation. */
  localDiscovery?: ESPLocalDiscoveryAdapterInterface;
}

/**
 * Removes a single trailing `/` from a URL or path segment.
 *
 * @param url - Absolute URL or path that may end with a slash.
 * @returns The same string without a trailing slash.
 */
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Resolves and normalizes the User/auth API base URL.
 *
 * @param config - SDK configuration; `userApiBase` is required.
 * @returns Normalized User/auth API base (no trailing slash).
 * @throws {ESPConfigError} With {@link ConfigErrorCodes.INVALID_USER_API_BASE}
 *   when `userApiBase` is missing or empty.
 */
export function resolveUserApiBase(config: ESPRMNeoBaseConfig): string {
  if (config.userApiBase == null || config.userApiBase === "") {
    logger.error(BaseLogMessages.RESOLVE_USER_API_BASE, {
      code: ConfigErrorCodes.INVALID_USER_API_BASE,
    });
    throw new ESPConfigError(ConfigErrorCodes.INVALID_USER_API_BASE);
  }
  const resolved = stripTrailingSlash(config.userApiBase);
  logger.debug(BaseLogMessages.RESOLVE_USER_API_BASE, { resolved });
  return resolved;
}

/**
 * Reads optional adapters from config without writing {@link ESPRMNeoBase} statics.
 * The caller assigns the returned values onto Base fields.
 *
 * @param config - SDK configuration from {@link ESPRMNeoBase.configure}.
 * @returns Adapter bag (any field may be `undefined` if not supplied).
 */
export function extractAdaptersFromConfig(
  config: ESPRMNeoBaseConfig
): ESPRMNeoBaseAdapters {
  const adapters: ESPRMNeoBaseAdapters = {
    storage: config.customStorageAdapter,
    provision: config.provisionAdapter,
    localControl: config.localControlAdapter,
    localDiscovery: config.localDiscoveryAdapter,
  };
  logger.debug(BaseLogMessages.EXTRACT_ADAPTERS, {
    hasStorage: !!adapters.storage,
    hasProvision: !!adapters.provision,
    hasLocalControl: !!adapters.localControl,
    hasLocalDiscovery: !!adapters.localDiscovery,
  });
  return adapters;
}

/**
 * Initializes {@link ESPRMNeoMqtt} and {@link NodeMQTTOrchestrator} when
 * `config.mqttAdapter` is present. No-op when MQTT is not configured.
 *
 * @param config - SDK configuration from {@link ESPRMNeoBase.configure}.
 * @throws {Error} If MQTT / orchestrator are already initialized (call
 *   {@link disposePeerSingletons} first).
 */
export function initializeMqttIfConfigured(config: ESPRMNeoBaseConfig): void {
  if (!config.mqttAdapter) {
    logger.debug(BaseLogMessages.MQTT_SKIP);
    return;
  }
  logger.info(BaseLogMessages.MQTT_INIT);
  ESPRMNeoMqtt.initialize(config.mqttAdapter);
  NodeMQTTOrchestrator.initialize(ESPRMNeoMqtt.getInstance());
}

/**
 * Initializes storage, the User API manager, and the SigV4 API manager.
 *
 * @param config - SDK configuration (provides `baseUrl`, `awsRegion`, User API base).
 * @param storageAdapter - Optional custom storage; when omitted, storage uses its default.
 * @throws {Error} If an API manager is already initialized (call
 *   {@link disposePeerSingletons} first).
 */
export function initializeApiStack(
  config: ESPRMNeoBaseConfig,
  storageAdapter?: ESPStorageAdapter
): void {
  const userApiBase = resolveUserApiBase(config);
  const baseUrl = stripTrailingSlash(config.baseUrl);
  logger.info(BaseLogMessages.API_STACK_INIT, {
    baseUrl,
    userApiBase,
    hasCustomStorage: !!storageAdapter,
    awsRegion: config.awsRegion,
  });
  ESPRMNeoStorage.initialize(storageAdapter);
  initializeAPIManager({ userApiBase });
  initializeSigV4APIManager({
    baseUrl,
    awsRegion: config.awsRegion,
  });
}

/**
 * Creates an {@link ESPRMNeoSubscriptionManager} and, when MQTT is configured,
 * registers the default MQTT channel synchronously.
 *
 * @param config - SDK configuration (MQTT presence controls channel registration).
 * @returns A new subscription manager owned by the caller (typically Base).
 */
export function createSubscriptionManager(
  config: ESPRMNeoBaseConfig
): ESPRMNeoSubscriptionManager {
  logger.debug(BaseLogMessages.SUBSCRIPTION_CREATE, {
    registerMqtt: !!config.mqttAdapter,
  });
  const manager = new ESPRMNeoSubscriptionManager();
  if (config.mqttAdapter) {
    logger.info(BaseLogMessages.SUBSCRIPTION_MQTT_REGISTER);
    registerMqttChannelIfNeeded(manager);
  }
  return manager;
}

/**
 * Constructs {@link ESPRMNeoAuth} for the given config.
 * Call only after config validation; the caller retains ownership.
 *
 * @param config - Validated SDK configuration.
 * @returns A new auth instance for the given config.
 */
export function createAuthInstance(config: ESPRMNeoBaseConfig): ESPRMNeoAuth {
  logger.debug(BaseLogMessages.AUTH_CREATE, {
    awsRegion: config.awsRegion,
  });
  return new ESPRMNeoAuth(config);
}

/**
 * Resets peer module singletons (subscription channels, MQTT, API managers,
 * storage) so {@link ESPRMNeoBase.configure} can run again.
 *
 * Does **not** clear {@link ESPRMNeoBase} static fields — the caller must do that.
 *
 * @param subscriptionManager - Active manager to dispose, or `null` if none.
 */
export function disposePeerSingletons(
  subscriptionManager: ESPRMNeoSubscriptionManager | null
): void {
  logger.info(BaseLogMessages.DISPOSE_PEERS, {
    hasSubscriptionManager: !!subscriptionManager,
  });

  if (subscriptionManager) {
    void subscriptionManager.dispose().catch((error) => {
      logger.error(BaseLogMessages.DISPOSE_SUBSCRIPTION_FAILED, error);
    });
  }

  try {
    ESPRMNeoMqtt.clear();
  } catch (error) {
    logger.debug(BaseLogMessages.MQTT_CLEAR_SKIPPED, error);
  }
  try {
    NodeMQTTOrchestrator.clear();
  } catch (error) {
    logger.debug(BaseLogMessages.ORCHESTRATOR_CLEAR_SKIPPED, error);
  }

  _resetAPIManagerForTests();
  _resetSigV4APIManagerForTests();
  _resetESPRMNeoStorageForTests();
}

/**
 * Returns a fresh copy of {@link DEFAULT_TRANSPORT_ORDER} for Base init / reset.
 *
 * @returns New array of default transport modes (safe to mutate).
 */
export function createDefaultTransportOrder(): (ESPTransportMode | string)[] {
  return [...DEFAULT_TRANSPORT_ORDER];
}

/**
 * Validates and shallow-copies a transport priority order.
 *
 * @param order - Non-empty ordered list of {@link ESPTransportMode} values or custom keys.
 * @returns A copy of `order`.
 * @throws {ESPConfigError} With {@link ConfigErrorCodes.INVALID_TRANSPORT_ORDER}
 *   if `order` is missing, empty, or not an array.
 */
export function copyTransportOrder(
  order: (ESPTransportMode | string)[]
): (ESPTransportMode | string)[] {
  if (!Array.isArray(order) || order.length === 0) {
    logger.error(BaseLogMessages.TRANSPORT_ORDER_INVALID, {
      code: ConfigErrorCodes.INVALID_TRANSPORT_ORDER,
      isArray: Array.isArray(order),
      length: Array.isArray(order) ? order.length : undefined,
    });
    throw new ESPConfigError(ConfigErrorCodes.INVALID_TRANSPORT_ORDER);
  }
  return [...order];
}

/**
 * Guards Base getters/setters that require a prior {@link ESPRMNeoBase.configure}.
 *
 * @param isInitialized - Whether the relevant Base state is present.
 * @throws {ESPConfigError} With {@link ConfigErrorCodes.SDK_NOT_CONFIGURED}
 *   when `isInitialized` is false.
 */
export function assertSdkInitialized(isInitialized: boolean): void {
  if (!isInitialized) {
    logger.error(BaseLogMessages.SDK_NOT_INITIALIZED, {
      code: ConfigErrorCodes.SDK_NOT_CONFIGURED,
    });
    throw new ESPConfigError(ConfigErrorCodes.SDK_NOT_CONFIGURED);
  }
}

/**
 * Guards adapter setters: the adapter argument must be a non-falsy value.
 *
 * @param adapter - Adapter instance supplied by the app.
 * @param code - Matching adapter {@link ConfigErrorCodes} entry for the error message.
 * @throws {ESPConfigError} With `code` when `adapter` is missing or falsy.
 */
export function assertAdapterProvided(
  adapter: unknown,
  code: AdapterConfigErrorCode
): asserts adapter {
  if (!adapter) {
    logger.error(BaseLogMessages.ADAPTER_INVALID, {
      code,
      message: configErrorMessages[code],
    });
    throw new ESPConfigError(code);
  }
}

/**
 * Logs which optional pieces of {@link ESPRMNeoBaseConfig} are present (debug).
 *
 * @param config - SDK configuration about to be applied.
 */
export function logConfigSummary(config: ESPRMNeoBaseConfig): void {
  logger.debug(BaseLogMessages.CONFIG_SUMMARY, {
    hasBaseUrl: !!config.baseUrl,
    hasUserApiBase: !!config.userApiBase,
    hasAwsRegion: !!config.awsRegion,
    hasCustomStorageAdapter: !!config.customStorageAdapter,
    hasProvisionAdapter: !!config.provisionAdapter,
    hasMqttAdapter: !!config.mqttAdapter,
    hasLocalControlAdapter: !!config.localControlAdapter,
    hasLocalDiscoveryAdapter: !!config.localDiscoveryAdapter,
  });
}
