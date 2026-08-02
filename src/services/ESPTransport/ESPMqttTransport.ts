/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPAPIResponse } from "../../types/output";
import { ESPTransportInterface } from "../../types/transport";
import { NodeMQTTOrchestrator } from "../NodeMQTTOrchestrator";

/**
 * Built-in `mqtt` transport — the RainMaker Neo cloud channel. Drives node
 * params over MQTT (AWS IoT shadow / RainMaker user params topic) through
 * {@link NodeMQTTOrchestrator}.
 */
class ESPMqttTransport implements ESPTransportInterface {
  async setParam(
    payload: Record<string, any>,
    _nodeRef?: ESPRMNeoNode
  ): Promise<ESPAPIResponse> {
    await NodeMQTTOrchestrator.setParams(payload.node_id, payload.payload);
    return { message: "Parameters updated successfully", statusCode: 200 };
  }

  async getParams(
    payload: Record<string, any>,
    _nodeRef?: ESPRMNeoNode
  ): Promise<Record<string, any>> {
    return NodeMQTTOrchestrator.getParams(payload.node_id);
  }
}

export { ESPMqttTransport };
