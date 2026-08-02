/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPSigV4APIManager } from "../ESPSigV4APIManager";
import type {
  ESPRMNeoTSAggregatesResponseAPI,
  ESPRMNeoTSDataOptions,
  ESPRMNeoTSDataResult,
  ESPRMNeoTSLatestDataResponseAPI,
  ESPRMNeoTSRawDataResponseAPI,
} from "../../types/tsData";
import { APICallValidationErrorCodes, APIPathV1 } from "../../utils/constants";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";
import { Logger } from "../../utils/logger";
import {
  buildTSQueryString,
  resolveTSWindow,
  transformTSAggregateEntry,
  transformTSDataPoint,
} from "../../utils/tsDataUtils";

const logger = new Logger("FetchTSData");

/**
 * Everything needed to query the timeseries endpoints for one param.
 * Shared by the node-level (`getCustomParam*TSData`) and param-level
 * (`get*TSData`) method APIs.
 */
export interface FetchTSDataConfig {
  groupId: string;
  nodeId: string;
  /** Backend param key, `"<device_id>.<param_id>"`. */
  key: string;
  /** Backend data type (`bool` | `int` | `float` | `string`). */
  dataType: string;
  options?: ESPRMNeoTSDataOptions;
}

/**
 * Fetches raw time-series samples (newest first) from
 * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/raw`.
 * `options.startTs` (Unix ms) is required; `endTs` defaults to now.
 * When more pages exist the result carries `hasNext: true` and a
 * `fetchNext()` closure that resolves the next page.
 */
export const fetchRawTSData = async (
  config: FetchTSDataConfig,
  startKeyParam?: string
): Promise<ESPRMNeoTSDataResult> => {
  const { options } = config;
  if (options?.startTs === undefined) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_TS_START_TIME
    );
  }
  const query = buildTSQueryString({
    key: config.key,
    data_type: config.dataType,
    start_time: options.startTs,
    end_time: options.endTs,
    page_size: options.pageSize,
    start_key: startKeyParam ?? options.startKey,
  });
  const endpoint = `${APIPathV1.groupNodeTimeseriesRaw(config.groupId, config.nodeId)}?${query}`;
  try {
    const response = await ESPSigV4APIManager.getInstance().get<
      ESPRMNeoTSRawDataResponseAPI
    >(endpoint);
    const nextKey = response?.next_key;
    const result: ESPRMNeoTSDataResult = {
      data: (response?.data ?? []).map(transformTSDataPoint),
      nextKey,
      pageTotal: response?.page_total,
      hasNext: !!nextKey,
    };
    if (nextKey) {
      result.fetchNext = () => fetchRawTSData(config, nextKey);
    }
    return result;
  } catch (error) {
    logger.error("Failed to get raw time-series data", {
      nodeId: config.nodeId,
      key: config.key,
      error,
    });
    throw error;
  }
};

/**
 * Fetches the most recent time-series sample from
 * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/latest`.
 * Returns at most one point in `data` (empty when the param has no samples).
 */
export const fetchLatestTSData = async (
  config: FetchTSDataConfig
): Promise<ESPRMNeoTSDataResult> => {
  const query = buildTSQueryString({
    key: config.key,
    data_type: config.dataType,
  });
  const endpoint = `${APIPathV1.groupNodeTimeseriesLatest(config.groupId, config.nodeId)}?${query}`;
  try {
    const response = await ESPSigV4APIManager.getInstance().get<
      ESPRMNeoTSLatestDataResponseAPI
    >(endpoint);
    // Unlike /raw, the /latest endpoint returns `data` as a single object.
    return {
      data: response?.data ? [transformTSDataPoint(response.data)] : [],
      hasNext: false,
    };
  } catch (error) {
    logger.error("Failed to get latest time-series data", {
      nodeId: config.nodeId,
      key: config.key,
      error,
    });
    throw error;
  }
};

/**
 * Fetches windowed aggregates from
 * `GET /v1/groups/{groupId}/nodes/{nodeId}/timeseries/aggregates`.
 * `options.window` is required. Provide no date (current live window),
 * `date` (one completed window), or `startDate`/`endDate` (paginated range —
 * `hasNext`/`fetchNext()` cover the following pages).
 */
export const fetchAggregatedTSData = async (
  config: FetchTSDataConfig,
  startKeyParam?: string
): Promise<ESPRMNeoTSDataResult> => {
  const { options } = config;
  const window = resolveTSWindow(options);
  const query = buildTSQueryString({
    key: config.key,
    data_type: config.dataType,
    window,
    date: options?.date,
    start_date: options?.startDate,
    end_date: options?.endDate,
    page_size: options?.pageSize,
    start_key: startKeyParam ?? options?.startKey,
  });
  const endpoint = `${APIPathV1.groupNodeTimeseriesAggregates(config.groupId, config.nodeId)}?${query}`;
  try {
    const response = await ESPSigV4APIManager.getInstance().get<
      ESPRMNeoTSAggregatesResponseAPI
    >(endpoint);
    const nextKey = response?.next_key;
    const result: ESPRMNeoTSDataResult = {
      data: [],
      aggregates: (response?.aggregates ?? []).map((entry) =>
        transformTSAggregateEntry(entry, window)
      ),
      nextKey,
      pageTotal: response?.page_total,
      hasNext: !!nextKey,
    };
    if (nextKey) {
      result.fetchNext = () => fetchAggregatedTSData(config, nextKey);
    }
    return result;
  } catch (error) {
    logger.error("Failed to get aggregated time-series data", {
      nodeId: config.nodeId,
      key: config.key,
      window,
      error,
    });
    throw error;
  }
};
