/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESP RainMaker Neo time-series type definitions.
 *
 * Public (camelCase) types used by the node-level (`getCustomParam*TSData`)
 * and param-level (`get*TSData`) method APIs, plus the raw (snake_case)
 * response shapes of the backend timeseries endpoints.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public time-series interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregation windows supported by the timeseries aggregates API.
 */
export type ESPRMNeoTSAggregationWindow =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly";

/**
 * Options for time-series data queries.
 *
 * Raw queries (`getRawTSData`): `startTs` is required (Unix ms; seconds are
 * also accepted by the backend), `endTs` defaults to now.
 * Aggregate queries (`getTSData`): `window` is required. Provide either no
 * date (current live window), `date` (single completed window), or
 * `startDate` + `endDate` (paginated range of completed windows).
 */
export interface ESPRMNeoTSDataOptions {
  /** Range start, Unix timestamp in milliseconds (raw queries; required). */
  startTs?: number;
  /** Range end, Unix timestamp in milliseconds (raw queries; defaults to now). */
  endTs?: number;
  /** Aggregation window (aggregate queries; required). */
  window?: ESPRMNeoTSAggregationWindow;
  /** Single completed window: `YYYY-MM-DD` (or `YYYY-MM-DDTHH` for hourly). */
  date?: string;
  /** Range of completed windows: start date `YYYY-MM-DD` (with `endDate`). */
  startDate?: string;
  /** Range of completed windows: end date `YYYY-MM-DD` (with `startDate`). */
  endDate?: string;
  /** Page size (backend default 20). */
  pageSize?: number;
  /** Opaque pagination token from a previous result's `nextKey`. */
  startKey?: string;
  /** Overrides the param's `data_type` sent to the backend (rarely needed). */
  dataType?: string;
  /**
   * Overrides the backend param key entirely, skipping the node-config
   * lookup. Required for data models the config lookup cannot resolve —
   * e.g. Matter attributes, whose key is `"0x<ep>.0x<cluster>.0x<attr>"`
   * in lowercase, unpadded hex — the exact format the firmware publishes.
   * Must be paired with `dataType`, since a Matter node config carries no
   * data types.
   */
  key?: string;
}

/**
 * A single time-series data point.
 */
export interface ESPRMNeoTSDataPoint {
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  /** Reported param value; its type matches `dataType`. */
  value: unknown;
  /** Backend data type of the value (`bool` | `int` | `float` | `string`). */
  dataType?: string;
  /** IANA timezone reported by the device for this point. */
  timezone?: string;
  /** True when the param is cumulative (e.g. an energy meter reading). */
  cumulative?: boolean;
}

/**
 * Statistics of one aggregation window.
 * For cumulative params, use `cumulativeValue` (consumption within the
 * window) rather than `sum`.
 */
export interface ESPRMNeoTSWindowAggregate {
  /** Number of samples in the window. */
  count?: number;
  /** Sum of the sample values. */
  sum?: number;
  /** Minimum sample value in the window. */
  min?: number;
  /** Maximum sample value in the window. */
  max?: number;
  /** Average of the sample values. */
  average?: number;
  /** First sample value in the window. */
  firstValue?: number;
  /** Last sample value in the window. */
  lastValue?: number;
  /** Consumption within the window (cumulative params only). */
  cumulativeValue?: number;
  /** RFC3339 window start. */
  windowStart?: string;
  /** RFC3339 window end. */
  windowEnd?: string;
  /** `"completed"` for archived historical windows. */
  status?: string;
  /** Backend stats not yet modeled here are passed through by the transform. */
  [key: string]: unknown;
}

/**
 * One aggregate entry (per parameter, per window/date).
 */
export interface ESPRMNeoTSAggregateEntry {
  /** Backend parameter identity, `"<node_id>.<key>.<data_type>"`. */
  parameter?: string;
  /** True when the param is cumulative (e.g. an energy meter). */
  isCumulative?: boolean;
  /** Window key/date of this entry (historical range results). */
  date?: string;
  /** Aggregates keyed by window type. */
  windows: Partial<
    Record<ESPRMNeoTSAggregationWindow, ESPRMNeoTSWindowAggregate>
  >;
  /** Backend fields not yet modeled here are passed through by the transform. */
  [key: string]: unknown;
}

/**
 * Time-series data result.
 * Raw/latest queries populate `data`; aggregate queries populate `aggregates`.
 */
export interface ESPRMNeoTSDataResult {
  /** Data points, newest first (raw/latest queries; empty for aggregates). */
  data: ESPRMNeoTSDataPoint[];
  /** Aggregate entries (aggregate queries only). */
  aggregates?: ESPRMNeoTSAggregateEntry[];
  /** Pass back as `startKey` to fetch the next page; absent on the last page. */
  nextKey?: string;
  /** Number of items in this page, as reported by the backend. */
  pageTotal?: number;
  /** True when more pages exist (see {@link ESPRMNeoTSDataResult.fetchNext}). */
  hasNext?: boolean;
  /** Resolves the next page with the same query; set only when `hasNext`. */
  fetchNext?: () => Promise<ESPRMNeoTSDataResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw timeseries API response interfaces (snake_case)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw API time-series sample (snake_case). The backend emits `key`; older
 * swagger examples show `name` — both are tolerated.
 */
export interface ESPRMNeoTSDataPointAPI {
  /** Backend param key, `"<device_id>.<param_id>"`. */
  key?: string;
  /** Legacy alias of `key` (older swagger examples). */
  name?: string;
  /** Backend data type of `value` (`bool` | `int` | `float` | `string`). */
  dt?: string;
  /** Unix timestamp in milliseconds. */
  ts: number;
  /** Reported param value; its type matches `dt`. */
  value: unknown;
  /** IANA timezone reported by the device for this sample. */
  tz?: string;
  /** True when the param is cumulative (e.g. an energy meter reading). */
  cumulative?: boolean;
}

/**
 * Raw API response of GET .../timeseries/raw (snake_case).
 */
export interface ESPRMNeoTSRawDataResponseAPI {
  /** Samples, newest first. */
  data?: ESPRMNeoTSDataPointAPI[];
  /** Number of items in this page. */
  page_total?: number;
  /** Pagination token for the next page; absent on the last page. */
  next_key?: string;
}

/**
 * Raw API response of GET .../timeseries/latest (snake_case).
 * Note: `data` is a single object, not an array.
 */
export interface ESPRMNeoTSLatestDataResponseAPI {
  /** Most recent sample; absent when the param has no data yet. */
  data?: ESPRMNeoTSDataPointAPI;
}

/**
 * Raw API window aggregate (snake_case).
 */
export interface ESPRMNeoTSWindowAggregateAPI {
  /** Number of samples in the window. */
  count?: number;
  /** Sum of the sample values. */
  sum?: number;
  /** Minimum sample value in the window. */
  min?: number;
  /** Maximum sample value in the window. */
  max?: number;
  /** Average of the sample values. */
  average?: number;
  /** First sample value in the window. */
  first_value?: number;
  /** Last sample value in the window. */
  last_value?: number;
  /** Consumption within the window (cumulative params only). */
  cumulative_value?: number;
  /** RFC3339 window start. */
  window_start?: string;
  /** RFC3339 window end. */
  window_end?: string;
  /** `"completed"` for archived historical windows. */
  status?: string;
  /** Lets the transform's rest-spread carry unmodeled backend stats through. */
  [key: string]: unknown;
}

/**
 * Raw API aggregate entry (snake_case).
 */
export interface ESPRMNeoTSAggregateEntryAPI {
  /** Backend parameter identity, `"<node_id>.<key>.<data_type>"`. */
  parameter?: string;
  /** True when the param is cumulative (e.g. an energy meter). */
  is_cumulative?: boolean;
  /** Window key/date of this entry (historical range results). */
  date?: string;
  /** Aggregates keyed by window type. */
  windows?: Record<string, ESPRMNeoTSWindowAggregateAPI>;
  /** Lets the transform's rest-spread carry unmodeled backend fields through. */
  [key: string]: unknown;
}

/**
 * Raw API response of GET .../timeseries/aggregates (snake_case).
 */
export interface ESPRMNeoTSAggregatesResponseAPI {
  /** One entry per parameter, per window/date. */
  aggregates?: ESPRMNeoTSAggregateEntryAPI[];
  /** Number of items in this page. */
  page_total?: number;
  /** Pagination token for the next page; absent on the last page. */
  next_key?: string;
}
