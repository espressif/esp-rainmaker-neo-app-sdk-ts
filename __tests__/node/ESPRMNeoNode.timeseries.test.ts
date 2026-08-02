/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for the node/param time-series methods (`getCustomParam*TSData`,
 * `get*TSData`) through the mock backend boundary.
 *
 * ⚠️ ALL fixtures here are deliberately NOT wrapped in
 * validated("Timeseries*Response") — the spec's timeseries section disagrees
 * with the deployed backend in three ways (each verified against the rmneo
 * source): data points carry `key` where the spec requires `name`;
 * `window_start`/`window_end` are RFC3339 strings on the wire
 * (processed_ts_db.go formats Unix seconds via time.RFC3339) where the spec
 * says integer; and the value fields' `oneOf: [number, integer, ...]` can
 * never validate a whole number (matches two branches). Spec-pin this suite
 * once the backend fixes the spec.
 */

import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { ESPRMNeoDevice } from "../../src/ESPRMNeoDevice";

const h = setupSdkTest();

const GROUP_ID = "group1";
const NODE_ID = "node123";

const RAW = `/v1/groups/${GROUP_ID}/nodes/${NODE_ID}/timeseries/raw`;
const LATEST = `/v1/groups/${GROUP_ID}/nodes/${NODE_ID}/timeseries/latest`;
const AGGREGATES = `/v1/groups/${GROUP_ID}/nodes/${NODE_ID}/timeseries/aggregates`;

/** A node with one device without running the heavy constructor (no MQTT attach). */
function makeNode(): ESPRMNeoNode {
  const node = Object.create(ESPRMNeoNode.prototype) as ESPRMNeoNode;
  node.nodeId = NODE_ID;
  node.groupId = GROUP_ID;
  node.devices = [
    new ESPRMNeoDevice(
      {
        name: "Sensor",
        displayName: "Sensor",
        type: "esp.device.sensor",
        params: [
          {
            id: "Temperature",
            dataType: "float",
            properties: ["read", "time_series"],
          },
          { id: "Name", dataType: "string", properties: ["read", "write"] },
        ],
        primary: "Temperature",
      },
      new WeakRef(node)
    ),
  ];
  return node;
}

const rawApiPoint = {
  key: "Sensor.Temperature",
  dt: "float",
  ts: 1640995200000,
  value: 23.5,
  tz: "UTC",
  cumulative: false,
};

const expectedPoint = {
  timestamp: 1640995200000,
  value: 23.5,
  dataType: "float",
  timezone: "UTC",
  cumulative: false,
};

describe("ESPRMNeoNode.getCustomParamRawTSData", () => {
  it("queries the raw endpoint with key/data_type/time range and maps the response", async () => {
    const node = makeNode();
    h.api.respond("GET", RAW, {
      data: [rawApiPoint],
      page_total: 1,
      next_key: "token123",
    });

    const result = await node.getCustomParamRawTSData!(
      "Sensor",
      "Temperature",
      { startTs: 1000, endTs: 2000, pageSize: 5, startKey: "prevTok" }
    );

    const [call] = h.api.callsTo("GET", RAW);
    expect(call.query).toEqual({
      key: "Sensor.Temperature",
      data_type: "float",
      start_time: "1000",
      end_time: "2000",
      page_size: "5",
      start_key: "prevTok",
    });
    expect(result).toMatchObject({
      data: [expectedPoint],
      nextKey: "token123",
      pageTotal: 1,
      hasNext: true,
    });
    expect(typeof result.fetchNext).toBe("function");
  });

  it("omits optional query params and pagination fields on the last page", async () => {
    const node = makeNode();
    h.api.respond("GET", RAW, { data: [rawApiPoint], page_total: 1 });

    const result = await node.getCustomParamRawTSData!(
      "Sensor",
      "Temperature",
      { startTs: 1000 }
    );

    const [call] = h.api.callsTo("GET", RAW);
    expect(call.query).toEqual({
      key: "Sensor.Temperature",
      data_type: "float",
      start_time: "1000",
    });
    expect(result.nextKey).toBeUndefined();
    expect(result.hasNext).toBe(false);
    expect(result.fetchNext).toBeUndefined();
  });

  it("fetchNext resolves the following page using the returned next_key", async () => {
    const node = makeNode();
    h.api
      .respond("GET", RAW, { data: [rawApiPoint], next_key: "page2tok" }, { times: 1 })
      .respond("GET", RAW, { data: [rawApiPoint] }, { times: 1 });

    const firstPage = await node.getCustomParamRawTSData!(
      "Sensor",
      "Temperature",
      { startTs: 1000 }
    );
    const secondPage = await firstPage.fetchNext!();

    const calls = h.api.callsTo("GET", RAW);
    expect(calls).toHaveLength(2);
    expect(calls[1].query.start_key).toBe("page2tok");
    expect(secondPage.hasNext).toBe(false);
    expect(secondPage.data).toEqual([expectedPoint]);
  });

  it("throws when startTs is missing", async () => {
    const node = makeNode();
    await expect(
      node.getCustomParamRawTSData!("Sensor", "Temperature")
    ).rejects.toThrow("startTs");
    expect(h.api.calls).toHaveLength(0);
  });

  it("throws when the param is not found on the node", async () => {
    const node = makeNode();
    await expect(
      node.getCustomParamRawTSData!("Sensor", "Humidity", { startTs: 1 })
    ).rejects.toThrow("Param not found on the node's config");
  });

  it("an explicit options.key skips the config lookup (Matter variant)", async () => {
    const node = makeNode();
    h.api.respond("GET", RAW, { data: [] });

    // "Endpoint"/"Attribute" don't exist in the node's devices — the explicit
    // key + dataType pair must be used as-is, without any lookup or error.
    await node.getCustomParamRawTSData!("Endpoint", "Attribute", {
      startTs: 1000,
      key: "0x1.0x402.0x0",
      dataType: "int",
    });

    const [call] = h.api.callsTo("GET", RAW);
    expect(call.query).toEqual({
      key: "0x1.0x402.0x0",
      data_type: "int",
      start_time: "1000",
    });
  });

  it("an explicit options.key without dataType throws", async () => {
    const node = makeNode();
    await expect(
      node.getCustomParamRawTSData!("Sensor", "Temperature", {
        startTs: 1,
        key: "0x1.0x402.0x0",
      })
    ).rejects.toThrow("options.dataType");
    expect(h.api.calls).toHaveLength(0);
  });

  it("honors the dataType override from options", async () => {
    const node = makeNode();
    h.api.respond("GET", RAW, { data: [] });

    await node.getCustomParamRawTSData!("Sensor", "Temperature", {
      startTs: 1,
      dataType: "int",
    });

    const [call] = h.api.callsTo("GET", RAW);
    expect(call.query.data_type).toBe("int");
  });
});

describe("ESPRMNeoNode.getCustomParamLatestTSData", () => {
  it("wraps the single latest sample into a one-point data array", async () => {
    const node = makeNode();
    h.api.respond("GET", LATEST, { data: rawApiPoint });

    const result = await node.getCustomParamLatestTSData!(
      "Sensor",
      "Temperature"
    );

    const [call] = h.api.callsTo("GET", LATEST);
    expect(call.query).toEqual({
      key: "Sensor.Temperature",
      data_type: "float",
    });
    expect(result).toEqual({ data: [expectedPoint], hasNext: false });
  });

  it("returns an empty data array when there is no sample", async () => {
    const node = makeNode();
    h.api.respond("GET", LATEST, {});

    const result = await node.getCustomParamLatestTSData!(
      "Sensor",
      "Temperature"
    );
    expect(result).toEqual({ data: [], hasNext: false });
  });
});

describe("ESPRMNeoNode.getCustomParamTSData (aggregates)", () => {
  it("queries the aggregates endpoint and maps snake_case window stats", async () => {
    const node = makeNode();
    h.api.respond("GET", AGGREGATES, {
      aggregates: [
        {
          parameter: "node123.Sensor.Temperature.float",
          is_cumulative: true,
          windows: {
            daily: {
              count: 2,
              sum: 3,
              min: 1,
              max: 2,
              average: 1.5,
              first_value: 1,
              last_value: 2,
              cumulative_value: 5,
              window_start: "2025-01-04T00:00:00Z",
              window_end: "2025-01-05T00:00:00Z",
            },
          },
        },
      ],
      page_total: 1,
      next_key: "aggTok",
    });

    const result = await node.getCustomParamTSData!("Sensor", "Temperature", {
      window: "daily",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      pageSize: 10,
    });

    const [call] = h.api.callsTo("GET", AGGREGATES);
    expect(call.query).toEqual({
      key: "Sensor.Temperature",
      data_type: "float",
      window: "daily",
      start_date: "2025-01-01",
      end_date: "2025-01-31",
      page_size: "10",
    });
    expect(result.data).toEqual([]);
    expect(result.nextKey).toBe("aggTok");
    expect(result.pageTotal).toBe(1);
    expect(result.hasNext).toBe(true);
    expect(typeof result.fetchNext).toBe("function");
    expect(result.aggregates).toEqual([
      {
        parameter: "node123.Sensor.Temperature.float",
        isCumulative: true,
        windows: {
          daily: {
            count: 2,
            sum: 3,
            min: 1,
            max: 2,
            average: 1.5,
            firstValue: 1,
            lastValue: 2,
            cumulativeValue: 5,
            windowStart: "2025-01-04T00:00:00Z",
            windowEnd: "2025-01-05T00:00:00Z",
          },
        },
      },
    ]);
  });

  it("nests flat historical-range entries under the requested window", async () => {
    // Real range-mode payload shape: stats sit directly on the entry (no
    // `windows` map) — the backend nests windows only in the current-
    // aggregates-without-window mode.
    const node = makeNode();
    h.api.respond("GET", AGGREGATES, {
      aggregates: [
        {
          average: 28.20208986415886,
          count: 957,
          cumulative_value: 0,
          date: "2026-07-27",
          first_value: 24.6,
          is_cumulative: false,
          last_value: 25,
          max: 50,
          min: 0,
          status: "completed",
          sum: 26989.40000000003,
          window_end: "2026-07-27T16:00:00Z",
          window_start: "2026-07-26T16:00:00Z",
        },
      ],
      page_total: 1,
      query_info: {
        end_date: "2026-07-27",
        parameter: "node123.Temp Sensor.Temperature.float",
        start_date: "2026-07-21",
        window_type: "daily",
      },
    });

    const result = await node.getCustomParamTSData!("Sensor", "Temperature", {
      window: "daily",
      startDate: "2026-07-21",
      endDate: "2026-07-27",
    });

    expect(result.hasNext).toBe(false);
    expect(result.aggregates).toEqual([
      {
        date: "2026-07-27",
        parameter: undefined,
        isCumulative: false,
        windows: {
          daily: {
            count: 957,
            sum: 26989.40000000003,
            min: 0,
            max: 50,
            average: 28.20208986415886,
            firstValue: 24.6,
            lastValue: 25,
            cumulativeValue: 0,
            windowStart: "2026-07-26T16:00:00Z",
            windowEnd: "2026-07-27T16:00:00Z",
            status: "completed",
          },
        },
      },
    ]);
  });

  it("passes date for a single historical window", async () => {
    const node = makeNode();
    h.api.respond("GET", AGGREGATES, { aggregates: [] });

    await node.getCustomParamTSData!("Sensor", "Temperature", {
      window: "hourly",
      date: "2025-01-04T14",
    });

    const [call] = h.api.callsTo("GET", AGGREGATES);
    expect(call.query.window).toBe("hourly");
    expect(call.query.date).toBe("2025-01-04T14");
  });

  it("throws when no valid window is provided", async () => {
    const node = makeNode();
    await expect(
      node.getCustomParamTSData!("Sensor", "Temperature")
    ).rejects.toThrow("options.window");
    expect(h.api.calls).toHaveLength(0);
  });
});

describe("ESPRMNeoDeviceParam time-series methods", () => {
  it("getRawTSData queries the raw endpoint with the param's own identity", async () => {
    const node = makeNode();
    const param = node.devices[0].params[0];
    h.api.respond("GET", RAW, { data: [rawApiPoint] });

    const result = await param.getRawTSData({ startTs: 1000 });

    const [call] = h.api.callsTo("GET", RAW);
    expect(call.path).toBe(RAW);
    expect(call.query).toMatchObject({
      key: "Sensor.Temperature",
      data_type: "float",
    });
    expect(result.data).toEqual([expectedPoint]);
  });

  it("getTSData queries the aggregates endpoint", async () => {
    const node = makeNode();
    const param = node.devices[0].params[0];
    h.api.respond("GET", AGGREGATES, { aggregates: [] });

    await param.getTSData({ window: "weekly" });

    const calls = h.api.callsTo("GET", AGGREGATES);
    expect(calls).toHaveLength(1);
    expect(calls[0].query.window).toBe("weekly");
  });

  it("getLatestTSData queries the latest endpoint", async () => {
    const node = makeNode();
    const param = node.devices[0].params[0];
    h.api.respond("GET", LATEST, { data: rawApiPoint });

    const result = await param.getLatestTSData();

    expect(h.api.callsTo("GET", LATEST)).toHaveLength(1);
    expect(result.data).toEqual([expectedPoint]);
  });

  it("getRawTSData requires startTs like the node-level method", async () => {
    const node = makeNode();
    const param = node.devices[0].params[0];

    await expect(param.getRawTSData()).rejects.toThrow("startTs");
    expect(h.api.calls).toHaveLength(0);
  });

  it("param-level pagination exposes fetchNext through the shared helper", async () => {
    const node = makeNode();
    const param = node.devices[0].params[0];
    h.api
      .respond("GET", RAW, { data: [rawApiPoint], next_key: "page2tok" }, { times: 1 })
      .respond("GET", RAW, { data: [] }, { times: 1 });

    const firstPage = await param.getRawTSData({ startTs: 1000 });
    expect(firstPage.hasNext).toBe(true);

    await firstPage.fetchNext!();
    const calls = h.api.callsTo("GET", RAW);
    expect(calls).toHaveLength(2);
    expect(calls[1].query.start_key).toBe("page2tok");
  });
});
