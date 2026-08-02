/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { fetchAggregatedTSData } from "../../services/ESPRMNeoHelpers/FetchTSData";
import type {
  ESPRMNeoTSDataOptions,
  ESPRMNeoTSDataResult,
} from "../../types/tsData";
import { resolveTSParamIdentity } from "../../utils/tsDataUtils";

/**
 * Augments the ESPRMNeoNode class with the `getCustomParamTSData` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Gets aggregated time-series data for a device param from
     * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/aggregates`.
     *
     * Query modes (all require `options.window`):
     * - no date options: current (live) window
     * - `date`: one completed historical window
     * - `startDate` + `endDate`: paginated range of completed windows
     *
     * @param deviceName - Device name.
     * @param paramName - Parameter name.
     * @param options - Query options (`window` required; `date` or
     *   `startDate`/`endDate` for historical windows; paginate via
     *   `pageSize`/`startKey` or the result's `fetchNext()`).
     * @returns Promise resolving to time-series data with `aggregates` populated.
     */
    getCustomParamTSData?(
      deviceName: string,
      paramName: string,
      options?: ESPRMNeoTSDataOptions
    ): Promise<ESPRMNeoTSDataResult>;
  }
}

ESPRMNeoNode.prototype.getCustomParamTSData = async function (
  deviceName: string,
  paramName: string,
  options?: ESPRMNeoTSDataOptions
): Promise<ESPRMNeoTSDataResult> {
  const { key, dataType } = resolveTSParamIdentity(
    this,
    deviceName,
    paramName,
    options
  );
  return fetchAggregatedTSData({
    groupId: this.groupId,
    nodeId: this.nodeId,
    key,
    dataType,
    options,
  });
};
