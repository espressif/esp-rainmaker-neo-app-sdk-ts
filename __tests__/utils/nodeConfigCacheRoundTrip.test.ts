/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regression tests for the node-config cache round trip.
 *
 * Older SDK versions persisted `{...this}` (the runtime node, camelCase
 * params) to the NODE_CONFIG_PREFIX key that getNode()/applyNodeConfig()
 * read back through the snake_case API transforms. That silently dropped
 * data_type/ui_type/valid_strings from every param until the next cloud
 * sync — downstream, the app then treated numeric sliders as "string"
 * params and sent "" instead of 0 in schedules/automations.
 */

import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { ESPRMNeoStorage } from "../../src/services/ESPRMNeoStorage/ESPRMNeoStorage";
import {
  transformApiParamForNodeDevice,
  transformApiParamForNodeService,
} from "../../src/utils/nodeTransform";
import type { NodeConfigAPI } from "../../src/types/output";
import { StorageKeys } from "../../src/utils/constants";

jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");
jest.mock("../../src/services/NodeMQTTOrchestrator", () => ({
  NodeMQTTOrchestrator: {
    registerNode: jest.fn(),
    subscribeToNode: jest.fn().mockResolvedValue(undefined),
    getParams: jest.fn().mockResolvedValue(undefined),
  },
}));

const rawApiParam = {
  id: "Brightness",
  type: "esp.param.brightness",
  data_type: "int",
  ui_type: "esp.ui.slider",
  properties: ["read", "write"],
  bounds: { min: 0, max: 100 },
};

const rawNodeConfigAPI: NodeConfigAPI = {
  node_id: "node-1",
  devices: [
    {
      id: "Light",
      type: "esp.device.lightbulb",
      params: [rawApiParam],
    },
  ],
  services: [],
} as unknown as NodeConfigAPI;

describe("transformApiParamForNodeDevice", () => {
  it("reads the raw API shape (snake_case)", () => {
    const out = transformApiParamForNodeDevice(rawApiParam as any);
    expect(out.dataType).toBe("int");
    expect(out.uiType).toBe("esp.ui.slider");
    expect(out.bounds).toEqual({ min: 0, max: 100 });
  });

  it("heals the legacy cached runtime shape (camelCase)", () => {
    const legacyCachedParam = {
      id: "Brightness",
      type: "esp.param.brightness",
      properties: ["read", "write"],
      dataType: "int",
      uiType: "esp.ui.slider",
      bounds: { min: 0, max: 100 },
      validStrings: undefined,
      value: 0,
      _nodeRef: {},
    };
    const out = transformApiParamForNodeDevice(legacyCachedParam as any);
    expect(out.dataType).toBe("int");
    expect(out.uiType).toBe("esp.ui.slider");
    expect(out.bounds).toEqual({ min: 0, max: 100 });
  });

  it("heals camelCase validStrings on service params", () => {
    const out = transformApiParamForNodeService({
      id: "Mode",
      properties: ["read", "write"],
      dataType: "string",
      validStrings: ["fast", "slow"],
    } as any);
    expect(out.dataType).toBe("string");
    expect(out.validStrings).toEqual(["fast", "slow"]);
  });
});

describe("ESPRMNeoNode processNodeUpdate cache write", () => {
  beforeEach(() => {
    (ESPRMNeoStorage.getItem as jest.Mock).mockResolvedValue(null);
    (ESPRMNeoStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  function lastCachedConfig(nodeId: string): any {
    const writes = (ESPRMNeoStorage.setItem as jest.Mock).mock.calls.filter(
      ([key]) => key === StorageKeys.NODE_CONFIG_PREFIX + nodeId
    );
    expect(writes.length).toBeGreaterThan(0);
    return JSON.parse(writes[writes.length - 1][1]);
  }

  it("persists API-shaped config (devices/services + params)", () => {
    const node = new ESPRMNeoNode(rawNodeConfigAPI, "group-1");

    (node as any).processNodeUpdate({
      state: { reported: { params: { Light: { Brightness: 42 } } } },
    });

    const cached = lastCachedConfig("node-1");
    // Source records stay snake_case API shape — not live SDK instances.
    expect(cached.devices[0].params[0]).toMatchObject({
      id: "Brightness",
      data_type: "int",
      ui_type: "esp.ui.slider",
    });
    expect(cached.devices[0].params[0].dataType).toBeUndefined();
    expect(cached.config).toBeUndefined();
    expect(cached.params).toEqual({ Light: { Brightness: 42 } });
  });

  it("survives a full cache round trip with metadata intact", () => {
    const node = new ESPRMNeoNode(rawNodeConfigAPI, "group-1");
    (node as any).processNodeUpdate({
      state: { reported: { params: { Light: { Brightness: 42 } } } },
    });

    // Simulate next app start: getNode() reads the cache and rebuilds the node.
    const reloaded = new ESPRMNeoNode(lastCachedConfig("node-1"), "group-1");
    const param = reloaded.devices[0].params[0];
    expect(param.dataType).toBe("int");
    expect(param.uiType).toBe("esp.ui.slider");
    expect(param.bounds).toEqual({ min: 0, max: 100 });
    expect(param.value).toBe(42);
  });
});

describe("ESPRMNeoNode applyNodeConfig applies passed params", () => {
  beforeEach(() => {
    (ESPRMNeoStorage.getItem as jest.Mock).mockResolvedValue(null);
    (ESPRMNeoStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("applies config.params onto rebuilt devices/services", () => {
    const configWithLocalControl = {
      ...rawNodeConfigAPI,
      services: [
        {
          id: "Local Control",
          type: "esp.service.local_control",
          params: [
            {
              id: "POP",
              type: "esp.param.local_control_pop",
              data_type: "string",
              properties: ["read"],
            },
            {
              id: "Type",
              type: "esp.param.local_control_type",
              data_type: "int",
              properties: ["read"],
            },
          ],
        },
      ],
    } as unknown as NodeConfigAPI;
    const node = new ESPRMNeoNode(configWithLocalControl, "group-1");

    node.applyNodeConfig({
      ...configWithLocalControl,
      params: { "Local Control": { POP: "NEW", Type: 1 } },
    } as unknown as NodeConfigAPI);

    const popParam = node.services
      .find((s) => s.name === "Local Control")!
      .params.find((p) => p.id === "POP")!;
    expect(popParam.value).toBe("NEW");
  });
});

describe("ESPRMNeoNode applyNodeConfig normalizes config.info", () => {
  beforeEach(() => {
    (ESPRMNeoStorage.getItem as jest.Mock).mockResolvedValue(null);
    (ESPRMNeoStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  const configWithInfo = {
    ...rawNodeConfigAPI,
    info: {
      name: "Smart Light",
      type: "esp.node.light",
      model: "LED_Smart_v2",
      fw_version: "2.1.0",
    },
  } as unknown as NodeConfigAPI;

  it("maps the wire `fw_version` to `firmwareVersion` (raw key kept)", () => {
    const node = new ESPRMNeoNode(configWithInfo, "group-1");

    expect(node.config.info?.firmwareVersion).toBe("2.1.0");
    expect(node.config.info?.fw_version).toBe("2.1.0");
    expect(node.config.info?.name).toBe("Smart Light");
    expect(node.config.info?.model).toBe("LED_Smart_v2");
  });

  it("is idempotent across a cache round trip of the enriched config", () => {
    const node = new ESPRMNeoNode(configWithInfo, "group-1");
    const reloaded = new ESPRMNeoNode(
      JSON.parse(JSON.stringify(node.config)),
      "group-1"
    );

    expect(reloaded.config.info?.firmwareVersion).toBe("2.1.0");
    expect(reloaded.config.info?.fw_version).toBe("2.1.0");
  });

  it("leaves a config without info untouched", () => {
    const node = new ESPRMNeoNode(rawNodeConfigAPI, "group-1");
    expect(node.config.info).toBeUndefined();
  });
});
