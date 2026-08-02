/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { fetchRawTSData } from "../../services/ESPRMNeoHelpers/FetchTSData";
import type {
  ESPRMNeoTSDataOptions,
  ESPRMNeoTSDataResult,
} from "../../types/tsData";
import { resolveTSParamIdentity } from "../../utils/tsDataUtils";

/**
 * Augments the ESPRMNeoNode class with the `getCustomParamRawTSData` method.
 */
declare module "../../ESPRMNeoNode" {
  interface ESPRMNeoNode {
    /**
     * Gets raw time-series samples for a device param (newest first) from
     * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/raw`.
     *
     * @param deviceName - Device name.
     * @param paramName - Parameter name.
     * @param options - Query options; `startTs` (Unix ms) is required,
     *   `endTs` defaults to now. Paginate via `pageSize`/`startKey` or the
     *   result's `fetchNext()`.
     * @returns Promise resolving to raw time-series data.
     */
    getCustomParamRawTSData?(
      deviceName: string,
      paramName: string,
      options?: ESPRMNeoTSDataOptions
    ): Promise<ESPRMNeoTSDataResult>;
  }
}

ESPRMNeoNode.prototype.getCustomParamRawTSData = async function (
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
  return fetchRawTSData({
    groupId: this.groupId,
    nodeId: this.nodeId,
    key,
    dataType,
    options,
  });
};
