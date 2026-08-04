/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoNode } from "./ESPRMNeoNode";
import { delegatedTransportHandler } from "./services/ESPRMNeoHelpers/DelegatedTransportHandler";
import type { ESPAPIResponse } from "./types/output";
import type {
  ESPRMNeoServiceParamInterface,
  ESPRMNeoParamInterface,
} from "./types/node";
import { APICallValidationErrorCodes } from "./utils/constants";
import { ESPAPICallValidationError } from "./utils/error/ESPAPICallValidationError";

/**
 * Service parameter – one parameter of a node service (e.g. timezone).
 * Holds a WeakRef to the parent node so writes can be dispatched via the best
 * available transport (see {@link delegatedTransportHandler}).
 */
export class ESPRMNeoServiceParam implements ESPRMNeoServiceParamInterface {
  readonly id: string;
  readonly type: string;
  readonly properties: string[];
  readonly dataType: string;
  readonly serviceName: string;
  readonly bounds?: Record<string, unknown>;
  readonly validStrings?: string[];
  value?: any;

  readonly _nodeRef: WeakRef<ESPRMNeoNode>;

  constructor(
    data: ESPRMNeoParamInterface & { serviceName: string },
    nodeRef: WeakRef<ESPRMNeoNode>
  ) {
    this.id = data.id;
    this.type = data.type ?? data.id;
    this.properties = data.properties ?? [];
    this.dataType = data.dataType;
    this.serviceName = data.serviceName;
    this.bounds = data.bounds;
    this.validStrings = data.validStrings;
    this.value = data.value;
    this._nodeRef = nodeRef;
  }

  setValue(value: any): Promise<ESPAPIResponse> {
    const node = this._nodeRef.deref();
    if (!node) {
      throw new ESPAPICallValidationError(
        APICallValidationErrorCodes.MISSING_NODE_REF
      );
    }
    const payload = {
      node_id: node.nodeId,
      payload: { [this.serviceName]: { [this.id]: value } },
    };
    return (delegatedTransportHandler<ESPAPIResponse>).call(node, (manager) =>
      manager.setParam(payload, node)
    );
  }
}
