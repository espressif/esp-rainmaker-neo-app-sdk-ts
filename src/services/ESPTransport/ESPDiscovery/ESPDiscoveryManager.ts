/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoBase } from "../../../ESPRMNeoBase";
import {
  DiscoveryParamsInterface,
  ESPDiscoveryCallback,
  ESPDiscoveryProtocol,
} from "../../../types/discovery";
import { ServiceType } from "../../../utils/constants";

/**
 * Manages local node discovery through the app-supplied local discovery
 * adapter (see {@link ESPRMNeoBase.setLocalDiscoveryAdapter}).
 *
 * - With no discovery config, the default local protocol is used
 *   (mDNS service `_esp_rmaker_ctrl._tcp.` in the `local` domain — the
 *   service advertised by RainMaker Neo firmware).
 * - A custom {@link DiscoveryParamsInterface} can be supplied to browse any
 *   other service type.
 */
class ESPDiscoveryManager {
  /** Discovery parameters (service type / domain) passed to the adapter. */
  params: DiscoveryParamsInterface;

  /**
   * @param discoveryConfig - Optional custom discovery parameters. Defaults to
   *   the local mDNS protocol.
   * @throws {Error} If no local discovery adapter is set.
   */
  constructor(discoveryConfig?: DiscoveryParamsInterface) {
    if (!ESPRMNeoBase.getLocalDiscoveryAdapter()) {
      throw new Error("ESPLocalDiscoveryAdapter not set");
    }
    this.params = discoveryConfig || {
      serviceType: ServiceType.ESP_RMAKER_LOCAL_CTRL_TCP,
      domain: ESPDiscoveryProtocol.local,
    };
  }

  private get adapter() {
    const adapter = ESPRMNeoBase.getLocalDiscoveryAdapter();
    if (!adapter) {
      throw new Error("ESPLocalDiscoveryAdapter not set");
    }
    return adapter;
  }

  /**
   * Starts discovery. The callback is invoked for each discovered node.
   *
   * @param callback - Invoked with the adapter's per-node discovery result.
   */
  startDiscovery(callback: ESPDiscoveryCallback): void {
    this.adapter.startDiscovery(callback, this.params);
  }

  /**
   * Stops any ongoing discovery started by {@link startDiscovery}.
   */
  stopDiscovery(): void {
    this.adapter.stopDiscovery();
  }
}

export { ESPDiscoveryManager };
