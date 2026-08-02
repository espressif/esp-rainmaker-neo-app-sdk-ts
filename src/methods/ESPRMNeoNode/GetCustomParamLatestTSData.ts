/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { fetchLatestTSData } from "../../services/ESPRMNeoHelpers/FetchTSData";
import type {
  ESPRMNeoTSDataOptions,
  ESPRMNeoTSDataResult,
} from "../../types/tsData";
import { resolveTSParamIdentity } from "../../utils/tsDataUtils";

/**
 * Augments the ESPRMNeoNode class with the `getCustomParamLatestTSData` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Gets the most recent time-series sample for a device param from
     * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/latest`.
     *
     * @param deviceName - Device name.
     * @param paramName - Parameter name.
     * @param options - Query options (only `dataType` override is used).
     * @returns Promise resolving to time-series data with at most one point
     *   in `data` (empty when the param has no samples yet).
     */
    getCustomParamLatestTSData?(
      deviceName: string,
      paramName: string,
      options?: ESPRMNeoTSDataOptions
    ): Promise<ESPRMNeoTSDataResult>;
  }
}

ESPRMNeoNode.prototype.getCustomParamLatestTSData = async function (
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
  return fetchLatestTSData({
    groupId: this.groupId,
    nodeId: this.nodeId,
    key,
    dataType,
    options,
  });
};
