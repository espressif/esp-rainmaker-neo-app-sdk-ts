/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoNode } from "./ESPRMNeoNode";
import { ESPRMNeoServiceParam } from "./ESPRMNeoServiceParam";
import type { ESPRMNeoServiceInterface } from "./types/node";

/**
 * Node-level service (not tied to a single device), e.g. time, local control.
 * Holds a WeakRef to the parent node for delegating getParams/setParams.
 */
export class ESPRMNeoService implements ESPRMNeoServiceInterface {
  readonly name: string;
  readonly type: string;
  readonly params: ESPRMNeoServiceParam[];

  readonly _nodeRef: WeakRef<ESPRMNeoNode>;

  constructor(
    data: Omit<ESPRMNeoServiceInterface, "params"> & {
      params?: Array<{ id: string; type?: string; properties?: string[]; dataType: string; serviceName?: string; bounds?: Record<string, unknown>; validStrings?: string[] }>;
    },
    nodeRef: WeakRef<ESPRMNeoNode>
  ) {
    this.name = data.name;
    this.type = data.type ?? "";
    this._nodeRef = nodeRef;
    this.params = (data.params ?? []).map(
      (p) =>
        new ESPRMNeoServiceParam(
          {
            id: p.id,
            type: p.type ?? p.id,
            properties: p.properties ?? [],
            dataType: p.dataType,
            serviceName: data.name,
            bounds: p.bounds,
            validStrings: p.validStrings,
          },
          nodeRef
        )
    );
  }

}
