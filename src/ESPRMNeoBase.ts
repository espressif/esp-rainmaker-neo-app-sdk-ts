/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoAuth } from "./ESPRMNeoAuth";
import { ESPRMNeoBaseConfig } from "./types/input";
import { ESPStorageAdapter } from "./types/storage";
import { ESPProvisionAdapterInterface } from "./types/provision";
import { ConfigValidator } from "./utils/validator/ConfigValidator";
import { Logger } from "./utils/logger";
import { ESPRMNeoSubscriptionManager } from "./services/ESPRMNeoSubscriptionManager";
import { ESPRMNeoStorage } from "./services/ESPRMNeoStorage/ESPRMNeoStorage";
import type { ESPLocalControlAdapterInterface } from "./types/localControl";
import type { ESPLocalDiscoveryAdapterInterface } from "./types/discovery";
import { ESPTransportMode } from "./types/transport";
import {
  assertAdapterProvided,
  assertSdkInitialized,
  copyTransportOrder,
  createAuthInstance,
  createDefaultTransportOrder,
  createSubscriptionManager,
  disposePeerSingletons,
  extractAdaptersFromConfig,
  initializeApiStack,
  initializeMqttIfConfigured,
  logConfigSummary,
} from "./utils/baseUtils";
import { ConfigErrorCodes } from "./utils/constants";

const logger = new Logger("ESPRMNeoBase");

/**
 * Configures and manages the ESP RainMaker Neo SDK.
 *
 * Holds process-wide configuration, adapters, and auth state. Call
 * {@link ESPRMNeoBase.configure} once before using other SDK APIs.
 * Low-level initialization helpers live in `utils/baseUtils`.
 */
export class ESPRMNeoBase {
  /** Active SDK configuration, or `null` before {@link configure} / after {@link dispose}. */
  static #config: ESPRMNeoBaseConfig | null = null;

  /** Auth instance created during {@link configure}. */
  private static authInstance: ESPRMNeoAuth | null = null;

  /** Subscription manager created during {@link configure}. */
  private static _subscriptionManager: ESPRMNeoSubscriptionManager | null =
    null;

  private static _storageAdapter?: ESPStorageAdapter;
  private static _provisionAdapter?: ESPProvisionAdapterInterface;
  private static _localControlAdapter?: ESPLocalControlAdapterInterface;

  /**
   * App-supplied adapter for local (LAN / mDNS) discovery.
   * Used when an app subscribes to `localDiscovery` via {@link ESPRMNeoUser.subscribe}.
   * Access via {@link getLocalDiscoveryAdapter}.
   */
  private static _localDiscoveryAdapter?: ESPLocalDiscoveryAdapterInterface;

  /**
   * Global default transport priority order.
   * Each node copies this at construction; apps may override globally via
   * {@link setTransportOrder} or per-node via `ESPRMNeoNode.setTransportOrder`.
   */
  private static globalTransportOrder: (ESPTransportMode | string)[] =
    createDefaultTransportOrder();

  /**
   * Configures the ESP RainMaker Neo SDK with the given options.
   * Must be called before using any other SDK functionality.
   *
   * If the SDK is already configured, previous state is disposed first so
   * re-configure is safe.
   *
   * @param config - Base URL (include API Gateway stage if any), Cognito/IoT
   *   settings, and optional adapters.
   * @throws {Error} If the configuration is invalid or initialization fails.
   */
  public static configure(config: ESPRMNeoBaseConfig): void {
    logger.debug("Starting SDK configuration");
    ConfigValidator.validateConfig(config);
    logConfigSummary(config);

    try {
      if (ESPRMNeoBase.#config) {
        ESPRMNeoBase.dispose();
      }

      const adapters = extractAdaptersFromConfig(config);
      ESPRMNeoBase._storageAdapter = adapters.storage;
      ESPRMNeoBase._provisionAdapter = adapters.provision;
      ESPRMNeoBase._localControlAdapter = adapters.localControl;
      ESPRMNeoBase._localDiscoveryAdapter = adapters.localDiscovery;

      initializeMqttIfConfigured(config);
      ESPRMNeoBase.authInstance = createAuthInstance(config);
      ESPRMNeoBase.#config = config;

      initializeApiStack(config, ESPRMNeoBase._storageAdapter);
      ESPRMNeoBase._subscriptionManager = createSubscriptionManager(config);
    } catch (error) {
      logger.error(
        "SDK initialization failed",
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Initializes the ESP RainMaker Neo SDK with the given configuration.
   * Back-compat alias for {@link configure}.
   *
   * @param config - Same options as {@link configure}.
   */
  static init(config: ESPRMNeoBaseConfig): void {
    ESPRMNeoBase.configure(config);
  }

  /**
   * Disposes SDK state and resets peer singletons so {@link configure} can run again.
   * Prefer this over `jest.resetModules()` when tearing down in tests.
   */
  public static dispose(): void {
    disposePeerSingletons(ESPRMNeoBase._subscriptionManager);
    ESPRMNeoBase._subscriptionManager = null;
    ESPRMNeoBase.#config = null;
    ESPRMNeoBase.authInstance = null;
    ESPRMNeoBase._storageAdapter = undefined;
    ESPRMNeoBase._provisionAdapter = undefined;
    ESPRMNeoBase._localControlAdapter = undefined;
    ESPRMNeoBase._localDiscoveryAdapter = undefined;
    ESPRMNeoBase.globalTransportOrder = createDefaultTransportOrder();
  }

  /**
   * Returns a readonly copy of the current SDK configuration.
   *
   * @returns Frozen shallow copy of the active config.
   * @throws {Error} If the SDK has not been initialized.
   */
  public static getConfig(): Readonly<ESPRMNeoBaseConfig> {
    assertSdkInitialized(!!ESPRMNeoBase.#config);
    return Object.freeze({ ...ESPRMNeoBase.#config! });
  }

  /**
   * Returns the authentication instance for the SDK.
   *
   * @returns The {@link ESPRMNeoAuth} instance used for auth operations.
   * @throws {Error} If the SDK has not been initialized.
   */
  public static getAuthInstance(): ESPRMNeoAuth {
    assertSdkInitialized(!!ESPRMNeoBase.authInstance);
    return ESPRMNeoBase.authInstance!;
  }

  /**
   * Returns the subscription manager instance.
   *
   * @returns The {@link ESPRMNeoSubscriptionManager} for managing subscriptions.
   * @throws {Error} If the SDK has not been initialized.
   */
  public static get subscriptionManager(): ESPRMNeoSubscriptionManager {
    assertSdkInitialized(!!ESPRMNeoBase._subscriptionManager);
    return ESPRMNeoBase._subscriptionManager!;
  }

  /**
   * Sets the storage adapter for the SDK and re-initializes persistent storage.
   *
   * @param adapter - Adapter implementing {@link ESPStorageAdapter}.
   * @throws {Error} If the SDK is not initialized or the adapter is invalid.
   */
  public static setStorageAdapter(adapter: ESPStorageAdapter): void {
    logger.debug("Setting storage adapter via method");
    assertSdkInitialized(!!ESPRMNeoBase.#config);
    assertAdapterProvided(adapter, ConfigErrorCodes.INVALID_STORAGE_ADAPTER);
    ESPRMNeoBase._storageAdapter = adapter;
    ESPRMNeoStorage.initialize(adapter);
  }

  /**
   * Gets the current storage adapter, if any.
   *
   * @returns The configured {@link ESPStorageAdapter}, or `undefined`.
   */
  static get storageAdapter(): ESPStorageAdapter | undefined {
    logger.debug("Getting storage adapter");
    return ESPRMNeoBase._storageAdapter;
  }

  /**
   * Sets the storage adapter for the SDK.
   *
   * Prefer {@link setStorageAdapter} for clearer call sites.
   *
   * @param adapter - Adapter implementing {@link ESPStorageAdapter}.
   */
  static set storageAdapter(adapter: ESPStorageAdapter) {
    logger.debug("Setting storage adapter via property setter");
    ESPRMNeoBase._storageAdapter = adapter;
    ESPRMNeoStorage.initialize(adapter);
  }

  /**
   * Sets the provisioning adapter for the SDK.
   *
   * @param adapter - Adapter implementing {@link ESPProvisionAdapterInterface}.
   * @throws {Error} If the SDK is not initialized or the adapter is invalid.
   */
  public static setProvisioningAdapter(
    adapter: ESPProvisionAdapterInterface
  ): void {
    assertSdkInitialized(!!ESPRMNeoBase.#config);
    assertAdapterProvided(adapter, ConfigErrorCodes.INVALID_PROVISION_ADAPTER);
    ESPRMNeoBase._provisionAdapter = adapter;
  }

  /**
   * Gets the provisioning adapter.
   *
   * @returns The provisioning adapter, or `undefined` if not configured.
   */
  public static getProvisionAdapter():
    | ESPProvisionAdapterInterface
    | undefined {
    return ESPRMNeoBase._provisionAdapter;
  }

  /**
   * Sets the local control adapter used to talk to nodes over the LAN via
   * the `rmaker_local_ctrl` protocol.
   *
   * @param adapter - Adapter implementing {@link ESPLocalControlAdapterInterface}.
   * @throws {Error} If the SDK is not initialized or the adapter is invalid.
   */
  public static setLocalControlAdapter(
    adapter: ESPLocalControlAdapterInterface
  ): void {
    assertSdkInitialized(!!ESPRMNeoBase.#config);
    assertAdapterProvided(
      adapter,
      ConfigErrorCodes.INVALID_LOCAL_CONTROL_ADAPTER
    );
    ESPRMNeoBase._localControlAdapter = adapter;
  }

  /**
   * Gets the local control adapter.
   *
   * @returns The local control adapter, or `undefined` if not configured.
   */
  public static getLocalControlAdapter():
    | ESPLocalControlAdapterInterface
    | undefined {
    return ESPRMNeoBase._localControlAdapter;
  }

  /**
   * Sets the local discovery adapter used to browse for nodes on the LAN
   * (mDNS). Required before subscribing to `localDiscovery` via
   * {@link ESPRMNeoUser.subscribe}.
   *
   * @param adapter - Adapter implementing {@link ESPLocalDiscoveryAdapterInterface}.
   * @throws {Error} If the SDK is not initialized or the adapter is invalid.
   */
  public static setLocalDiscoveryAdapter(
    adapter: ESPLocalDiscoveryAdapterInterface
  ): void {
    assertSdkInitialized(!!ESPRMNeoBase.#config);
    assertAdapterProvided(
      adapter,
      ConfigErrorCodes.INVALID_LOCAL_DISCOVERY_ADAPTER
    );
    ESPRMNeoBase._localDiscoveryAdapter = adapter;
  }

  /**
   * Gets the local discovery adapter.
   *
   * @returns The local discovery adapter, or `undefined` if not configured.
   */
  public static getLocalDiscoveryAdapter():
    | ESPLocalDiscoveryAdapterInterface
    | undefined {
    return ESPRMNeoBase._localDiscoveryAdapter;
  }

  /**
   * Sets the global default transport priority order.
   * New nodes adopt this order at construction; existing nodes keep their
   * current order unless updated per-node via `ESPRMNeoNode.setTransportOrder`.
   *
   * @param order - Non-empty ordered list of transport modes (built-in
   *   {@link ESPTransportMode} values or custom string keys).
   * @throws {ESPConfigError} If the order is empty or not an array.
   */
  public static setTransportOrder(order: (ESPTransportMode | string)[]): void {
    ESPRMNeoBase.globalTransportOrder = copyTransportOrder(order);
  }

  /**
   * Returns a copy of the global default transport priority order.
   *
   * @returns Shallow copy of the current transport order.
   */
  public static getTransportOrder(): (ESPTransportMode | string)[] {
    return [...ESPRMNeoBase.globalTransportOrder];
  }
}

/**
 * Test / teardown helper: clears Base state and peer singletons so
 * {@link ESPRMNeoBase.configure} can run again. Prefer this over
 * `jest.resetModules()`. Not re-exported from the public SDK barrel.
 *
 * @internal
 */
export function resetForTests(): void {
  ESPRMNeoBase.dispose();
}
