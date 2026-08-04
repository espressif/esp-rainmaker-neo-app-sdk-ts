/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPAPIResponse } from "../../types/output";
import {
  ESPTransportConfig,
  ESPTransportInterface,
  ESPTransportMode,
} from "../../types/transport";
import { ESPMqttTransport } from "./ESPMqttTransport";
import { ESPLocalControlTransport } from "./ESPLocalControlTransport";

/**
 * Selects and wraps a built-in transport implementation based on the transport
 * config `type`. The {@link delegatedTransportHandler} constructs one of these
 * per transport attempt and drives it through {@link ESPTransportInterface}.
 */
class ESPTransportManager implements ESPTransportInterface {
  private transport!: ESPTransportInterface;

  constructor(transportConfig: ESPTransportConfig) {
    if (transportConfig) {
      switch (transportConfig.type) {
        case ESPTransportMode.mqtt:
          this.transport = new ESPMqttTransport();
          break;
        case ESPTransportMode.local:
          this.transport = new ESPLocalControlTransport(transportConfig);
          break;
        default:
          throw new Error(
            `Unsupported transport type: ${transportConfig.type}. Please provide a transport manager via customTransportManagers.`
          );
      }
    }
  }

  setParam(
    payload: Record<string, any>,
    nodeRef?: ESPRMNeoNode
  ): Promise<ESPAPIResponse> {
    return this.transport.setParam(payload, nodeRef);
  }

  getParams(
    payload: Record<string, any>,
    nodeRef?: ESPRMNeoNode
  ): Promise<Record<string, any>> {
    return this.transport.getParams(payload, nodeRef);
  }
}

export { ESPTransportManager };
