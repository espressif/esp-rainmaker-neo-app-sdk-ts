/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoNode } from "./ESPRMNeoNode";
import { ESPRMNeoDeviceParam } from "./ESPRMNeoDeviceParam";
import type {
  ESPRMNeoDeviceInterface,
  ESPRMNeoAttributeInterface,
} from "./types/node";

/**
 * Logical device inside a node (e.g. switch, light, thermostat).
 * Holds a WeakRef to the parent node for delegating getParams/setParams.
 */
export class ESPRMNeoDevice implements ESPRMNeoDeviceInterface {
  readonly name: string;
  readonly displayName: string;
  readonly type: string;
  readonly attributes?: ESPRMNeoAttributeInterface[];
  readonly params: ESPRMNeoDeviceParam[];
  readonly primaryParam?: ESPRMNeoDeviceParam;

  readonly _nodeRef: WeakRef<ESPRMNeoNode>;

  constructor(
    data: Omit<ESPRMNeoDeviceInterface, "params" | "primaryParam"> & {
      params?: Array<{
        id: string;
        type?: string;
        properties?: string[];
        dataType: string;
        deviceName?: string;
        uiType?: string;
        bounds?: Record<string, unknown>;
        validStrings?: string[];
      }>;
      primary?: string;
    },
    nodeRef: WeakRef<ESPRMNeoNode>
  ) {
    this.name = data.name;
    this.displayName = data.displayName ?? data.name;
    this.type = data.type ?? "esp.device.generic";
    this.attributes = data.attributes;
    this._nodeRef = nodeRef;

    const paramInstances = (data.params ?? []).map(
      (p) =>
        new ESPRMNeoDeviceParam(
          {
            id: p.id,
            type: p.type ?? p.id,
            properties: p.properties ?? [],
            dataType: p.dataType,
            deviceName: data.name,
            uiType: p.uiType,
            bounds: p.bounds,
            validStrings: p.validStrings,
          },
          nodeRef
        )
    );
    this.params = paramInstances;
    const primaryName = data.primary ?? (data as { primary?: string }).primary;
    this.primaryParam = primaryName
      ? paramInstances.find((p) => p.id === primaryName)
      : paramInstances[0];
  }

  /** Parent node, if the weak reference is still alive. */
  getNode(): ESPRMNeoNode | undefined {
    return this._nodeRef.deref();
  }
}
