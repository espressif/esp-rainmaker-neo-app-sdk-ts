/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoBase } from "../../ESPRMNeoBase";
import type { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { Status } from "../../proto/constants";
import {
  CmdGetPropertyCount,
  CmdGetPropertyValues,
  CmdSetPropertyValues,
  LocalCtrlMessage,
  LocalCtrlMsgType,
  PropertyValue,
} from "../../proto/esp_local_ctrl";
import { ESPAPIResponse } from "../../types/output";
import {
  ESPTransportConfig,
  ESPTransportInterface,
} from "../../types/transport";
import { Endpoint } from "../../utils/constants";
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../ESPRMNeoHelpers/TransformEncoding";

/** Property index of the writable "params" property exposed by RMNeo local-control firmware. */
const LOCAL_CONTROL_PARAMS_INDEX = 1;

/**
 * Built-in `local` transport. Communicates with the node over the LAN through
 * the app-supplied {@link ESPRMNeoBase.ESPLocalControlAdapter} using the
 * `esp_local_ctrl` protobuf protocol. Connection metadata (`baseUrl`,
 * `securityType`, `pop`, and `username` for sec2) is supplied via the transport
 * config by {@link delegatedTransportHandler}.
 */
class ESPLocalControlTransport implements ESPTransportInterface {
  private payload: Record<string, any> | undefined;
  metadata: Record<string, any>;
  propertyInfo: Record<string, any> = {};

  constructor(transportConfig: ESPTransportConfig) {
    this.metadata = transportConfig.metadata ?? {};
  }

  private get adapter() {
    const adapter = ESPRMNeoBase.getLocalControlAdapter();
    if (!adapter) {
      throw new Error("Local control adapter is not configured");
    }
    return adapter;
  }

  /**
   * Connects to the node, retrying on failure. RMNeo's adapter resolves on a
   * successful connection and rejects otherwise, so a resolved call is treated
   * as connected.
   */
  private async connectWithRetry(
    nodeId: string,
    baseUrl: string,
    securityType: number,
    pop?: string,
    username?: string,
    maxRetries = 3
  ): Promise<void> {
    let attempt = 0;
    let lastError: unknown;
    while (attempt < maxRetries) {
      try {
        await this.adapter.connect(nodeId, baseUrl, securityType, pop, username);
        return;
      } catch (error: unknown) {
        lastError = error;
        attempt += 1;
      }
    }
    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Failed to connect after ${maxRetries} attempts: ${message}`);
  }

  private async ensureConnected(nodeId: string): Promise<void> {
    const isConnected = await this.adapter.isConnected(nodeId);
    if (!isConnected) {
      await this.connectWithRetry(
        nodeId,
        this.metadata.baseUrl,
        this.metadata.securityType ?? 0,
        this.metadata.pop,
        this.metadata.username
      );
    }
  }

  async setParam(
    payload: Record<string, any>,
    _nodeRef?: ESPRMNeoNode
  ): Promise<ESPAPIResponse> {
    this.payload = payload;
    await this.ensureConnected(this.payload?.node_id);

    const success = await this.setProperty(this.payload?.payload ?? {});
    if (!success) {
      throw new Error("Failed to set device params over local control");
    }
    return { message: "Parameters updated successfully", statusCode: 200 };
  }

  async getParams(
    payload: Record<string, any>,
    _nodeRef?: ESPRMNeoNode
  ): Promise<Record<string, any>> {
    this.payload = payload;
    await this.ensureConnected(this.payload?.node_id);
    return this.getPropertyInfo();
  }

  // ── set ──────────────────────────────────────────────────────────────────

  private async setProperty(json: Record<string, any>): Promise<boolean> {
    const request = this.buildSetPropertyRequest(json);
    const response = await this.adapter.sendData(
      this.payload?.node_id,
      Endpoint.LOCAL_CTRL,
      request
    );
    return this.processSetPropertyResponse(response);
  }

  private buildSetPropertyRequest(json: Record<string, any>): string {
    const message = new LocalCtrlMessage();
    message.msg = LocalCtrlMsgType.TypeCmdSetPropertyValues;

    const cmd = new CmdSetPropertyValues();
    const prop = new PropertyValue();
    prop.index = LOCAL_CONTROL_PARAMS_INDEX;
    prop.value = new TextEncoder().encode(JSON.stringify(json ?? {}));
    cmd.props.push(prop);

    message.cmd_set_prop_vals = cmd;
    return uint8ArrayToBase64(message.serialize());
  }

  private processSetPropertyResponse(response: string): boolean {
    const deserialized = LocalCtrlMessage.deserialize(base64ToUint8Array(response));
    return deserialized.resp_set_prop_vals.status === Status.Success;
  }

  // ── get ──────────────────────────────────────────────────────────────────

  /** Fetches the property count, then reads each property value into propertyInfo. */
  private async getPropertyInfo(): Promise<Record<string, any>> {
    this.propertyInfo = {};
    const count = await this.fetchPropertyCount();
    for (let index = 0; index < count; index++) {
      await this.fetchPropertyValue(index);
    }
    return this.propertyInfo;
  }

  private async fetchPropertyCount(): Promise<number> {
    const response = await this.adapter.sendData(
      this.payload?.node_id,
      Endpoint.LOCAL_CTRL,
      this.buildGetPropertyCountRequest()
    );
    return this.processGetPropertyCountResponse(response);
  }

  private buildGetPropertyCountRequest(): string {
    const request = new LocalCtrlMessage();
    request.msg = LocalCtrlMsgType.TypeCmdGetPropertyCount;
    request.cmd_get_prop_count = new CmdGetPropertyCount();
    return uint8ArrayToBase64(request.serialize());
  }

  private processGetPropertyCountResponse(response: string): number {
    const deserialized = LocalCtrlMessage.deserialize(
      base64ToUint8Array(response)
    );
    if (deserialized.resp_get_prop_count.status !== Status.Success) {
      throw new Error("Failed to retrieve property count from device");
    }
    return deserialized.resp_get_prop_count.count;
  }

  private async fetchPropertyValue(index: number): Promise<void> {
    const response = await this.adapter.sendData(
      this.payload?.node_id,
      Endpoint.LOCAL_CTRL,
      this.buildGetPropertyValueRequest(index)
    );
    const property = this.processGetPropertyValueResponse(response);
    if (property) {
      this.propertyInfo[property.name] = property.value;
    }
  }

  private buildGetPropertyValueRequest(index: number): string {
    const request = new LocalCtrlMessage();
    request.msg = LocalCtrlMsgType.TypeCmdGetPropertyValues;
    const cmd = new CmdGetPropertyValues();
    cmd.indices.push(index);
    request.cmd_get_prop_vals = cmd;
    return uint8ArrayToBase64(request.serialize());
  }

  private processGetPropertyValueResponse(
    response: string
  ): { name: string; value: any } | undefined {
    const deserialized = LocalCtrlMessage.deserialize(
      base64ToUint8Array(response)
    );
    if (deserialized.resp_get_prop_vals.status !== Status.Success) {
      throw new Error("Failed to get property values from device response");
    }
    const prop = deserialized.resp_get_prop_vals.props[0];
    if (!prop) return undefined;
    return {
      name: prop.name || "unknown",
      value: JSON.parse(new TextDecoder().decode(prop.value)),
    };
  }
}

export { ESPLocalControlTransport };
