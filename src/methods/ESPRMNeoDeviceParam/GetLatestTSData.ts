/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoDeviceParam } from "../../ESPRMNeoDeviceParam";
import { fetchLatestTSData } from "../../services/ESPRMNeoHelpers/FetchTSData";
import type {
  ESPRMNeoTSDataOptions,
  ESPRMNeoTSDataResult,
} from "../../types/tsData";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { tsParamIdentityFromParam } from "../../utils/tsDataUtils";

/**
 * Augments the ESPRMNeoDeviceParam class with the `getLatestTSData` method.
 */
declare module "../../ESPRMNeoDeviceParam" {
  interface ESPRMNeoDeviceParam {
    /**
     * Gets the most recent time-series sample for this param from
     * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/latest`.
     *
     * @param options - Query options (only `dataType` override is used).
     * @returns Promise resolving to time-series data with at most one point
     *   in `data` (empty when the param has no samples yet).
     */
    getLatestTSData(
      options?: ESPRMNeoTSDataOptions
    ): Promise<ESPRMNeoTSDataResult>;
  }
}

ESPRMNeoDeviceParam.prototype.getLatestTSData = async function (
  options?: ESPRMNeoTSDataOptions
): Promise<ESPRMNeoTSDataResult> {
  const node = this._nodeRef.deref();
  if (!node) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_NODE_REF
    );
  }
  const { key, dataType } = tsParamIdentityFromParam(this, options);
  return fetchLatestTSData({
    groupId: node.groupId,
    nodeId: node.nodeId,
    key,
    dataType,
    options,
  });
};
