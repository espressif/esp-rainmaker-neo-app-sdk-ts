/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoNode } from "../ESPRMNeoNode";
import type {
  ESPRMNeoTSAggregateEntry,
  ESPRMNeoTSAggregateEntryAPI,
  ESPRMNeoTSAggregationWindow,
  ESPRMNeoTSDataOptions,
  ESPRMNeoTSDataPoint,
  ESPRMNeoTSDataPointAPI,
  ESPRMNeoTSWindowAggregate,
  ESPRMNeoTSWindowAggregateAPI,
} from "../types/tsData";
import { APICallValidationErrorCodes } from "./constants";
import { ESPAPICallValidationError } from "./error/ESPAPICallValidationError";
import { Logger } from "./logger";

const logger = new Logger("TSDataUtils");

/** Param property flag marking a param as time-series capable (node config). */
export const TIME_SERIES_PROPERTY = "time_series";

const AGGREGATION_WINDOWS: ESPRMNeoTSAggregationWindow[] = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
];

/**
 * Backend query identity of a time-series param: the `key`
 * (`"<device_id>.<param_id>"`) and `data_type` every timeseries endpoint
 * requires. A `data_type` mismatch silently returns no data, so it is read
 * from the param metadata unless explicitly overridden via options.
 */
export interface TSParamIdentity {
  key: string;
  dataType: string;
}

/**
 * Returns the explicit query identity from options when the caller provided
 * one, bypassing any node-config lookup. This is the escape hatch for data
 * models the default lookup cannot resolve (e.g. Matter attributes).
 *
 * @throws {ESPAPICallValidationError} If `options.key` is set without `options.dataType`.
 */
export function tsParamIdentityFromOptions(
  options?: ESPRMNeoTSDataOptions
): TSParamIdentity | undefined {
  if (!options?.key) return undefined;
  if (!options.dataType) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_TS_CUSTOM_KEY_DATA_TYPE
    );
  }
  return { key: options.key, dataType: options.dataType };
}

/**
 * Builds the backend query identity from a device param's own metadata
 * (used by the param-level methods, where `this` IS the param).
 *
 * @throws {ESPAPICallValidationError} If no data type can be determined.
 */
export function tsParamIdentityFromParam(
  param: {
    id: string;
    deviceName: string;
    dataType?: string;
    properties?: string[];
  },
  options?: ESPRMNeoTSDataOptions
): TSParamIdentity {
  const explicit = tsParamIdentityFromOptions(options);
  if (explicit) return explicit;
  const key = `${param.deviceName}.${param.id}`;
  if (!param.properties?.includes(TIME_SERIES_PROPERTY)) {
    logger.warn(
      `Param "${key}" does not declare the "${TIME_SERIES_PROPERTY}" property; the backend may have no data for it`
    );
  }
  const dataType = options?.dataType ?? param.dataType;
  if (!dataType) {
    logger.error(`Param "${key}" has no data_type`);
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_TS_DATA_TYPE
    );
  }
  return { key, dataType };
}

/**
 * Resolves the backend query identity for a device param by looking it up in
 * the node's config (used by the node-level methods).
 *
 * @throws {ESPAPICallValidationError} If the param is not found on the node's config.
 */
export function resolveTSParamIdentity(
  node: ESPRMNeoNode,
  deviceName: string,
  paramId: string,
  options?: ESPRMNeoTSDataOptions
): TSParamIdentity {
  const explicit = tsParamIdentityFromOptions(options);
  if (explicit) return explicit;
  const device = node.devices?.find((d) => d.name === deviceName);
  const param = device?.params?.find((p) => p.id === paramId);
  if (!param) {
    logger.error(
      `Param "${paramId}" not found on device "${deviceName}" of node "${node.nodeId}"`
    );
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.TS_PARAM_NOT_FOUND
    );
  }
  return tsParamIdentityFromParam(param, options);
}

/**
 * Resolves the aggregation window from options.
 *
 * @throws {ESPAPICallValidationError} If no valid window is provided.
 */
export function resolveTSWindow(
  options?: ESPRMNeoTSDataOptions
): ESPRMNeoTSAggregationWindow {
  const candidate = options?.window;
  if (
    typeof candidate === "string" &&
    AGGREGATION_WINDOWS.includes(candidate)
  ) {
    return candidate;
  }
  throw new ESPAPICallValidationError(
    APICallValidationErrorCodes.INVALID_TS_WINDOW
  );
}

/**
 * Builds a URL query string from the given params, skipping undefined values.
 */
export function buildTSQueryString(
  params: Record<string, string | number | undefined>
): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join("&");
}

/**
 * Maps a raw API sample into an {@link ESPRMNeoTSDataPoint}.
 * The backend emits `key`; older swagger examples show `name` — both accepted.
 */
export function transformTSDataPoint(
  point: ESPRMNeoTSDataPointAPI
): ESPRMNeoTSDataPoint {
  return {
    timestamp: point.ts,
    value: point.value,
    dataType: point.dt,
    timezone: point.tz,
    cumulative: point.cumulative,
  };
}

function transformTSWindowAggregate(
  aggregate: ESPRMNeoTSWindowAggregateAPI
): ESPRMNeoTSWindowAggregate {
  const {
    first_value: firstValue,
    last_value: lastValue,
    cumulative_value: cumulativeValue,
    window_start: windowStart,
    window_end: windowEnd,
    ...rest
  } = aggregate;
  return {
    ...rest,
    firstValue,
    lastValue,
    cumulativeValue,
    windowStart,
    windowEnd,
  };
}

/**
 * Maps a raw API aggregate entry into an {@link ESPRMNeoTSAggregateEntry}.
 *
 * The backend emits two entry shapes:
 * - **Nested** (`windows: {hourly: {...}, ...}`) — only the current-aggregates
 *   query with no `window` param (all windows at once).
 * - **Flat** — historical `date`/`start_date`+`end_date` queries and the
 *   current-single-window query put the stats directly on the entry
 *   (`{date, window_start, count, average, ...}`), with no `windows` map.
 *
 * Flat entries are nested under `requestedWindow` so consumers always read
 * `entry.windows[window]` regardless of query mode.
 */
export function transformTSAggregateEntry(
  entry: ESPRMNeoTSAggregateEntryAPI,
  requestedWindow?: ESPRMNeoTSAggregationWindow
): ESPRMNeoTSAggregateEntry {
  const {
    is_cumulative: isCumulative,
    windows: rawWindows,
    ...rest
  } = entry;

  const windows: ESPRMNeoTSAggregateEntry["windows"] = {};
  if (rawWindows && Object.keys(rawWindows).length > 0) {
    for (const [windowName, aggregate] of Object.entries(rawWindows)) {
      windows[windowName as ESPRMNeoTSAggregationWindow] =
        transformTSWindowAggregate(aggregate);
    }
    return { ...rest, isCumulative, windows };
  }

  if (requestedWindow) {
    // Flat entry: everything except the entry-level identity fields is the
    // window's stat set.
    const { date, parameter, ...flatStats } = rest;
    windows[requestedWindow] = transformTSWindowAggregate(
      flatStats as ESPRMNeoTSWindowAggregateAPI
    );
    return { date, parameter, isCumulative, windows };
  }

  return { ...rest, isCumulative, windows };
}
