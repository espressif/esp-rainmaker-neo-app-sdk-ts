/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeConfig, NodeConfigAPI } from "./types/output";
import type {
  ESPRMNeoConnectivityStatusInterface,
  ESPRMNeoShadowDocument,
} from "./types/node";
import type {
  ESPNodeSubscriptionConfig,
  ESPNodeUpdateData,
} from "./types/subscription";
import { emitNodeUpdate } from "./services/NodeUpdatesBus";
import { Logger } from "./utils/logger";
import { NodeMQTTOrchestrator } from "./services/NodeMQTTOrchestrator";
import { ESPRMNeoService } from "./ESPRMNeoService";
import { ESPRMNeoDevice } from "./ESPRMNeoDevice";
import {
  constructDeviceParamsTopic,
  constructShadowName,
} from "./utils/shadowUtils";
import {
  extract,
  transformNodeDevice,
  transformNodeInfo,
  transformNodeService,
} from "./utils/nodeTransform";
import { ESPRMNeoStorage } from "./services/ESPRMNeoStorage/ESPRMNeoStorage";
import { StorageKeys, ConfigErrorCodes } from "./utils/constants";
import {
  hasNcfgVersionChanged,
  persistNcfgVersionMarker,
} from "./utils/nodeNcfgVersionHandler";
import { applyParamValues, mergeParamMaps } from "./utils/paramValues";
import { ESPRMNeoBase } from "./ESPRMNeoBase";
import {
  ESPTransportMode,
  ESPTransportConfig,
  ESPTransportInterface,
} from "./types/transport";
import { asStringArray } from "./utils/common";
import { ESPConfigError } from "./utils/error/Error";
const logger = new Logger("ESPRMNeoNode");

/**
 * Represents a node in the ESP Rainmaker Neo SDK.
 * Provides access to node configuration and metadata.
 *
 * Live updates arrive via the subscription manager
 * (`subscribeToNode` → {@link handleNodeUpdate}) and are re-broadcast on the
 * process-wide node-updates bus for `user.subscribe(nodeUpdates)`.
 */
export class ESPRMNeoNode {
  nodeId!: string;
  config!: NodeConfig;
  /** API/cache snapshot (snake_case devices/services) used for local persistence. */
  private wireConfig!: NodeConfigAPI;
  groupId: string;
  /** All subgroup IDs this node belongs to under {@link groupId} (shadow segment order from {@link constructShadowName}). Empty when the node lives only at the root group. */
  subgroupIds: string[] = [];
  devices: ESPRMNeoDevice[] = [];
  services: ESPRMNeoService[] = [];
  /**
   * Last-known connectivity. Seeded from cached `connectivity_status` when
   * present (cloud config does not provide it); otherwise starts offline until
   * an MQTT shadow `online` update arrives.
   */
  connectivityStatus: ESPRMNeoConnectivityStatusInterface = {
    isConnected: false,
    lastConnectionTimestamp: 0,
  };

  /**
   * Transports currently usable for this node, keyed by mode.
   * - `mqtt` (cloud) is added when the node is connected and removed when it
   *   goes offline (from cached `connectivity_status` or shadow updates).
   * - `local` is added/removed at runtime by a `localDiscovery` subscriber as the
   *   node appears/disappears on the LAN (via {@link addTransport}/{@link removeTransport}).
   * Apps may also add custom string-keyed entries (pair with
   * {@link customTransportManagers}).
   */
  availableTransports: Record<ESPTransportMode | string, ESPTransportConfig> =
    {};

  /**
   * Transport priority order for this node. Initialized from the global default
   * ({@link ESPRMNeoBase.getTransportOrder}); override per-node via
   * {@link setTransportOrder}.
   */
  transportOrder: (ESPTransportMode | string)[] = [];

  /**
   * Optional per-node custom transport implementations keyed by mode. When a
   * mode in {@link transportOrder} has an entry here, the transport handler uses
   * it in preference to the built-in local/MQTT backends. Enables BLE, WebSocket
   * or proprietary transports without modifying the SDK.
   */
  customTransportManagers?: Record<
    ESPTransportMode | string,
    ESPTransportInterface
  >;

  /**
   * Optional per-node subscription channel order, overriding the global order
   * on {@link ESPRMNeoBase.subscriptionManager}. Set and read via the
   * `setSubscriptionChannelOrder` / `getSubscriptionChannelOrder` methods
   * added by module augmentation in
   * `src/methods/ESPRMNeoNode/SubscriptionConfig.ts`.
   */
  subscriptionConfig?: ESPNodeSubscriptionConfig;

  constructor(
    config: NodeConfigAPI,
    groupId: string,
    subgroupIdOrIds?: string | string[]
  ) {
    this.groupId = groupId;
    this.subgroupIds = asStringArray(subgroupIdOrIds);
    this.transportOrder = ESPRMNeoBase.getTransportOrder();
    this.availableTransports = {};

    if (config.connectivity_status) {
      this.connectivityStatus = config.connectivity_status;
    }

    this.applyNodeConfig(config);
    this.syncMqttTransportAvailability();
    this.subscribeToMqttUpdates();
  }

  /**
   * Adds (or replaces) an available transport for this node, keyed by mode.
   * Works for built-in modes ({@link ESPTransportMode}) and custom string modes.
   * For a custom transport, also register its implementation via
   * {@link addCustomTransportManager}.
   *
   * @param mode - Transport mode key (e.g. `local`, `mqtt`, or a custom string).
   * @param config - The transport config (`{ type, metadata }`).
   */
  addTransport(
    mode: ESPTransportMode | string,
    config: ESPTransportConfig
  ): void {
    if (!mode || !config) return;
    this.availableTransports[mode] = config;
  }

  /**
   * Removes an available transport for this node by mode.
   *
   * @param mode - Transport mode key to remove.
   */
  removeTransport(mode: ESPTransportMode | string): void {
    delete this.availableTransports[mode];
  }

  /**
   * Registers (or replaces) a custom transport manager for a mode. The transport
   * handler prefers it over the built-in backend for that mode. Pair with
   * {@link addTransport} so the mode also appears in {@link availableTransports}
   * and participates in {@link transportOrder}.
   *
   * @param mode - Transport mode key the manager handles.
   * @param manager - Implementation of {@link ESPTransportInterface}.
   */
  addCustomTransportManager(
    mode: ESPTransportMode | string,
    manager: ESPTransportInterface
  ): void {
    if (!mode || !manager) return;
    if (!this.customTransportManagers) {
      this.customTransportManagers = {};
    }
    this.customTransportManagers[mode] = manager;
  }

  /**
   * Removes the custom transport manager registered for a mode (if any).
   *
   * @param mode - Transport mode key to clear.
   */
  removeCustomTransportManager(mode: ESPTransportMode | string): void {
    if (this.customTransportManagers) {
      delete this.customTransportManagers[mode];
    }
  }

  /**
   * Overrides the transport priority order for this node only.
   *
   * @param order - Non-empty ordered list of transport modes.
   * @throws {ESPConfigError} If the order is empty or not an array.
   */
  setTransportOrder(order: (ESPTransportMode | string)[]): void {
    if (!Array.isArray(order) || order.length === 0) {
      throw new ESPConfigError(ConfigErrorCodes.INVALID_TRANSPORT_ORDER);
    }
    this.transportOrder = [...order];
  }

  /**
   * Replaces config and rebuilds devices/services (used after cloud sync).
   *
   * Sets {@link config} so `config.devices` / `config.services` are the same
   * live {@link ESPRMNeoDevice} / {@link ESPRMNeoService} instances as
   * {@link devices} / {@link services}.
   */
  applyNodeConfig(config: NodeConfigAPI): void {
    this.nodeId = config.node_id ?? this.nodeId ?? "";
    const info = transformNodeInfo(config.info);

    const nodeRef = new WeakRef(this);
    const deviceRecords = Array.isArray(config.devices) ? config.devices : [];
    const serviceRecords = Array.isArray(config.services) ? config.services : [];

    this.devices = deviceRecords.map(
      (d) => new ESPRMNeoDevice(transformNodeDevice(d), nodeRef)
    );
    this.services = serviceRecords.map(
      (s) => new ESPRMNeoService(transformNodeService(s), nodeRef)
    );

    // Keep wire records for cache writes (never persist live class instances).
    // Preserve last-known connectivity when the incoming config omits it
    // (cloud node config does not include connectivity_status).
    this.wireConfig = {
      ...config,
      info,
      devices: deviceRecords,
      services: serviceRecords,
      connectivity_status:
        config.connectivity_status ?? this.connectivityStatus,
    };

    this.config = {
      ...config,
      info,
      devices: this.devices,
      services: this.services,
    };

    applyParamValues(this, config.params ?? {});
  }

  getShadowName(): string {
    return constructShadowName(this.groupId, this.subgroupIds);
  }

  /**
   * RainMaker params channel: rainmaker/nodes/{nodeId}/user/{shadowName}/params
   */
  getParamsTopic(): string {
    return constructDeviceParamsTopic(
      this.nodeId,
      this.groupId,
      this.subgroupIds
    );
  }

  /**
   * Registers this node with the MQTT orchestrator and subscribes via the
   * subscription manager so the highest-priority available channel serves it
   * (MQTT today; Matter/BLE when a satellite SDK registers one). Fire-and-forget
   * from the constructor — failures are logged, not thrown.
   */
  private async subscribeToMqttUpdates(): Promise<void> {
    const shadowName = this.getShadowName();
    try {
      // The MQTT channel reuses this registration rather than re-resolving
      // the shadow.
      NodeMQTTOrchestrator.registerNode(this.nodeId, shadowName);
      await ESPRMNeoBase.subscriptionManager.subscribeToNode(
        this,(update: ESPNodeUpdateData) => this.handleNodeUpdate(update)
      );
      // Warm read: the shadow GET response also arrives on the live
      // subscription, delivering the node's current params right after subscribe.
      await NodeMQTTOrchestrator.getParams(this.nodeId)

    } catch (error: any) {
      logger.error("Failed to subscribe to MQTT updates", error);
    }
  }

  /**
   * Handles a normalized update from the subscription manager: applies it to the
   * node's internal state (via {@link processNodeUpdate}) and re-broadcasts it on
   * the process-wide node-updates bus for `user.subscribe(nodeUpdates)`.
   *
   * For MQTT the full shadow is carried in `metadata.shadow`, so internal
   * bookkeeping (params + connectivity + config version) is unchanged. For a
   * channel that only provides a param map, a minimal shadow is reconstructed.
   *
   * @param update - The normalized node update.
   */
  private handleNodeUpdate(update: ESPNodeUpdateData): void {
    const shadow: ESPRMNeoShadowDocument =
      update.metadata?.shadow ?? {
        state: { reported: { params: update.payload } },
      };
    this.processNodeUpdate(shadow);
    emitNodeUpdate(update);
  }

  /**
   * Applies a shadow update: devices/services params, connectivity, cache.
   * If `ncfg_ver` changed, {@link ESPRMNeoNode#sync} → {@link applyNodeConfig}.
   */
  private processNodeUpdate(shadow: ESPRMNeoShadowDocument): void {
    const { params, connectivityStatus } = extract(shadow);

    if (Object.keys(params).length > 0) {
      applyParamValues(this, params);
      this.config.params = mergeParamMaps(this.config.params, params);
      this.wireConfig.params = this.config.params;
    }

    this.applyConnectivityStatus(shadow, connectivityStatus);

    this.persistWireConfig();

    this.refreshConfigIfNcfgChanged(shadow);
  }

  /**
   * Updates {@link connectivityStatus} when the shadow reports `online`, then
   * syncs MQTT transport availability. Partial updates without `online` are
   * ignored so an existing status is not cleared.
   */
  private applyConnectivityStatus(
    shadow: ESPRMNeoShadowDocument,
    connectivityStatus: ESPRMNeoConnectivityStatusInterface
  ): void {
    if (shadow.state?.reported?.online === undefined) return;

    this.connectivityStatus = connectivityStatus;
    this.wireConfig.connectivity_status = connectivityStatus;
    this.syncMqttTransportAvailability();
  }

  /**
   * Registers the MQTT transport only while {@link connectivityStatus} reports
   * the node as connected; removes it when offline.
   */
  private syncMqttTransportAvailability(): void {
    if (this.connectivityStatus.isConnected) {
      this.addTransport(ESPTransportMode.mqtt, {
        type: ESPTransportMode.mqtt,
        metadata: {},
      });
    } else {
      this.removeTransport(ESPTransportMode.mqtt);
    }
  }

  /** Persists {@link wireConfig} (including last-known connectivity) to storage. */
  private persistWireConfig(): void {
    ESPRMNeoStorage.setItem(
      StorageKeys.NODE_CONFIG_PREFIX + this.nodeId,
      JSON.stringify({
        ...this.wireConfig,
        node_id: this.nodeId,
        connectivity_status: this.connectivityStatus,
      })
    );
  }

  /** When cloud `ncfg_ver` changes, refetch config and persist the new marker. */
  private async refreshConfigIfNcfgChanged(
    shadow: ESPRMNeoShadowDocument
  ): Promise<void> {
    try {
      if (!(await hasNcfgVersionChanged(this.nodeId, shadow))) return;
      await this.sync();
      await persistNcfgVersionMarker(this.nodeId, shadow);
    } catch (error: unknown) {
      logger.error("Failed to refresh config on ncfg_ver change", error);
    }
  }
}
