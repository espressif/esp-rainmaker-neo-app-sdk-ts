/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoDeviceParam } from "../../ESPRMNeoDeviceParam";
import { fetchRawTSData } from "../../services/ESPRMNeoHelpers/FetchTSData";
import type {
  ESPRMNeoTSDataOptions,
  ESPRMNeoTSDataResult,
} from "../../types/tsData";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { tsParamIdentityFromParam } from "../../utils/tsDataUtils";

/**
 * Augments the ESPRMNeoDeviceParam class with the `getRawTSData` method.
 */
declare module "../../ESPRMNeoDeviceParam" {
  interface ESPRMNeoDeviceParam {
    /**
     * Gets raw time-series samples for this param (newest first) from
     * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/raw`.
     *
     * @param options - Query options; `startTs` (Unix ms) is required,
     *   `endTs` defaults to now. Paginate via `pageSize`/`startKey` or the
     *   result's `fetchNext()`.
     * @returns Promise resolving to raw time-series data.
     */
    getRawTSData(options?: ESPRMNeoTSDataOptions): Promise<ESPRMNeoTSDataResult>;
  }
}

ESPRMNeoDeviceParam.prototype.getRawTSData = async function (
  options?: ESPRMNeoTSDataOptions
): Promise<ESPRMNeoTSDataResult> {
  const node = this._nodeRef.deref();
  if (!node) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_NODE_REF
    );
  }
  const { key, dataType } = tsParamIdentityFromParam(this, options);
  return fetchRawTSData({
    groupId: node.groupId,
    nodeId: node.nodeId,
    key,
    dataType,
    options,
  });
};
