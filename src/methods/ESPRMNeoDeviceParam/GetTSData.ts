/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoDeviceParam } from "../../ESPRMNeoDeviceParam";
import { fetchAggregatedTSData } from "../../services/ESPRMNeoHelpers/FetchTSData";
import type {
  ESPRMNeoTSDataOptions,
  ESPRMNeoTSDataResult,
} from "../../types/tsData";
import { APICallValidationErrorCodes } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { tsParamIdentityFromParam } from "../../utils/tsDataUtils";

/**
 * Augments the ESPRMNeoDeviceParam class with the `getTSData` method.
 */
declare module "../../ESPRMNeoDeviceParam" {
  interface ESPRMNeoDeviceParam {
    /**
     * Gets aggregated time-series data for this param from
     * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/aggregates`.
     *
     * Query modes (all require `options.window`):
     * - no date options: current (live) window
     * - `date`: one completed historical window
     * - `startDate` + `endDate`: paginated range of completed windows
     *
     * @param options - Query options (`window` required; `date` or
     *   `startDate`/`endDate` for historical windows; paginate via
     *   `pageSize`/`startKey` or the result's `fetchNext()`).
     * @returns Promise resolving to time-series data with `aggregates` populated.
     */
    getTSData(options?: ESPRMNeoTSDataOptions): Promise<ESPRMNeoTSDataResult>;
  }
}

ESPRMNeoDeviceParam.prototype.getTSData = async function (
  options?: ESPRMNeoTSDataOptions
): Promise<ESPRMNeoTSDataResult> {
  const node = this._nodeRef.deref();
  if (!node) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_NODE_REF
    );
  }
  const { key, dataType } = tsParamIdentityFromParam(this, options);
  return fetchAggregatedTSData({
    groupId: node.groupId,
    nodeId: node.nodeId,
    key,
    dataType,
    options,
  });
};
