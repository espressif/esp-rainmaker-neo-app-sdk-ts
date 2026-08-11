/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for the `ESPRMNeoNode` class through its REAL constructor,
 * plus the `ESPRMNeoDevice` / `ESPRMNeoService` / `ESPRMNeoDeviceParam` object
 * graph it builds. The transport-map helpers have their own suite
 * (`ESPRMNeoNode.transports.test.ts`); this one covers construction,
 * config (re)application, and topic/shadow derivation.
 *
 * Fixtures use `id`-keyed devices/params — the shape the deployed backend
 * actually serializes (rmneo `NodeCfg`, src/service/config/config.go) and the
 * SDK consumes. ⚠️ Known spec defect (reported to the backend team): the spec's NodeConfig schema
 * wrongly documents `name` instead of `id`, so these fixtures are deliberately
 * NOT wrapped in validated("NodeConfig") — the schema would reject the real
 * shape under closed-world validation.
 */

import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { ESPRMNeoDevice } from "../../src/ESPRMNeoDevice";
import { ESPRMNeoDeviceParam } from "../../src/ESPRMNeoDeviceParam";
import { ESPRMNeoService } from "../../src/ESPRMNeoService";
import { ESPRMNeoServiceParam } from "../../src/ESPRMNeoServiceParam";
import { NodeConfigAPI } from "../../src/types/output";
import { configErrorMessages } from "../../src/utils/error/errorMessages";

setupSdkTest();

const GROUP_ID = "grp-core";
const NODE_ID = "node-core-1";

function fullConfig(): NodeConfigAPI {
  return {
    node_id: NODE_ID,
    params: {
      "light-1": { Power: true, Brightness: 80 },
    },
    devices: [
      {
        id: "light-1",
        type: "esp.device.lightbulb",
        primary: "Power",
        attributes: [{ name: "serial", value: "SN-42" }],
        params: [
          {
            id: "Power",
            type: "esp.param.power",
            data_type: "bool",
            properties: ["read", "write"],
            ui_type: "esp.ui.toggle",
          },
          {
            id: "Brightness",
            type: "esp.param.brightness",
            data_type: "int",
            properties: ["read", "write"],
            bounds: { min: 0, max: 100 },
          },
        ],
      },
    ],
    services: [
      {
        id: "time-1",
        type: "esp.service.time",
        params: [
          {
            id: "TZ",
            type: "esp.param.tz",
            data_type: "string",
            properties: ["read", "write"],
            valid_strings: ["UTC", "IST"],
          },
        ],
      },
    ],
  } as NodeConfigAPI;
}

describe("ESPRMNeoNode constructor", () => {
  it("builds the device graph from the node config", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);

    expect(node.nodeId).toBe(NODE_ID);
    expect(node.groupId).toBe(GROUP_ID);
    expect(node.devices).toHaveLength(1);

    const [device] = node.devices;
    expect(device).toBeInstanceOf(ESPRMNeoDevice);
    expect(device.name).toBe("light-1");
    expect(device.displayName).toBe("light-1");
    expect(device.type).toBe("esp.device.lightbulb");
    expect(device.attributes).toEqual([{ name: "serial", value: "SN-42" }]);
    expect(device.getNode()).toBe(node);
    // config.devices / config.services are the same live instances.
    expect(node.config.devices).toBe(node.devices);
    expect(node.config.services).toBe(node.services);
    expect(node.config.devices[0]).toBeInstanceOf(ESPRMNeoDevice);
  });

  it("builds device params with snake_case fields mapped and live values seeded", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);
    const [device] = node.devices;

    expect(device.params).toHaveLength(2);
    const power = device.params.find((p) => p.id === "Power")!;
    expect(power).toBeInstanceOf(ESPRMNeoDeviceParam);
    expect(power.dataType).toBe("bool");
    expect(power.uiType).toBe("esp.ui.toggle");
    expect(power.deviceName).toBe("light-1");
    // Seeded from config.params["light-1"].Power at construction time.
    expect(power.value).toBe(true);

    const brightness = device.params.find((p) => p.id === "Brightness")!;
    expect(brightness.bounds).toEqual({ min: 0, max: 100 });
    expect(brightness.value).toBe(80);

    // `primary` names the primary param by id.
    expect(device.primaryParam).toBe(power);
  });

  it("builds the service graph with validStrings mapped", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);

    expect(node.services).toHaveLength(1);
    const [service] = node.services;
    expect(service).toBeInstanceOf(ESPRMNeoService);
    expect(service.name).toBe("time-1");
    expect(service.type).toBe("esp.service.time");
    expect(service.params).toHaveLength(1);
    expect(service.params[0]).toBeInstanceOf(ESPRMNeoServiceParam);
    expect(service.params[0].dataType).toBe("string");
    expect(service.params[0].validStrings).toEqual(["UTC", "IST"]);
  });

  it("falls back to the first param when `primary` is absent", () => {
    const config = fullConfig();
    delete (config.devices[0] as { primary?: string }).primary;

    const node = new ESPRMNeoNode(config, GROUP_ID);

    expect(node.devices[0].primaryParam?.id).toBe("Power");
  });

  it("defaults device type and tolerates empty device/service lists", () => {
    const node = new ESPRMNeoNode(
      {
        node_id: NODE_ID,
        devices: [{ id: "bare-device", params: [] }],
        services: [],
      } as unknown as NodeConfigAPI,
      GROUP_ID
    );

    expect(node.devices[0].type).toBe("esp.device.generic");
    expect(node.devices[0].params).toEqual([]);
    expect(node.services).toEqual([]);
  });

  it("seeds connectivity from the config and lists the mqtt transport when online", () => {
    const config = {
      ...fullConfig(),
      connectivity_status: { isConnected: true, lastConnectionTimestamp: 123 },
    } as NodeConfigAPI;

    const node = new ESPRMNeoNode(config, GROUP_ID);

    expect(node.connectivityStatus).toEqual({
      isConnected: true,
      lastConnectionTimestamp: 123,
    });
    // Harness default transport order (ESPRMNeoBase.getTransportOrder).
    expect(node.transportOrder).toEqual(["cloud"]);
    expect(node.availableTransports.mqtt).toEqual({
      type: "mqtt",
      metadata: {},
    });
  });

  it("does not list mqtt transport when cached connectivity is offline", () => {
    const config = {
      ...fullConfig(),
      connectivity_status: { isConnected: false, lastConnectionTimestamp: 0 },
    } as NodeConfigAPI;

    const node = new ESPRMNeoNode(config, GROUP_ID);

    expect(node.connectivityStatus.isConnected).toBe(false);
    expect(node.availableTransports.mqtt).toBeUndefined();
  });

  it("defaults connectivity to offline when config has no connectivity_status", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);

    expect(node.connectivityStatus).toEqual({
      isConnected: false,
      lastConnectionTimestamp: 0,
    });
    expect(node.availableTransports.mqtt).toBeUndefined();
  });
});

describe("ESPRMNeoNode subgroup membership", () => {
  it("a single subgroup id normalizes into subgroupIds as a one-element array", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID, "sub-1");

    expect(node.subgroupIds).toEqual(["sub-1"]);
  });

  it("multiple subgroup ids are preserved in order in subgroupIds", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID, ["sub-2", "sub-1"]);

    expect(node.subgroupIds).toEqual(["sub-2", "sub-1"]);
  });

  it("no subgroups yields an empty list", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);

    expect(node.subgroupIds).toEqual([]);
  });
});

describe("ESPRMNeoNode shadow/topic derivation", () => {
  it("getShadowName is params-<groupId> for a root-group node", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);

    expect(node.getShadowName()).toBe(`params-${GROUP_ID}`);
  });

  it("getShadowName appends the SORTED subgroup ids", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID, ["sub-b", "sub-a"]);

    expect(node.getShadowName()).toBe(`params-${GROUP_ID}-sub-a-sub-b`);
  });

  it("getParamsTopic embeds node id and shadow name", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID, "sub-1");

    expect(node.getParamsTopic()).toBe(
      `rainmaker/nodes/${NODE_ID}/user/params-${GROUP_ID}-sub-1/params`
    );
  });
});

describe("ESPRMNeoNode.applyNodeConfig (re-sync)", () => {
  it("replaces the device graph and applies passed param values", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);
    const [device] = node.devices;

    device.params.find((p) => p.id === "Power")!.value = false;
    device.params.find((p) => p.id === "Brightness")!.value = 25;

    const resync = fullConfig();
    (resync.devices[0].params as unknown[]).pop(); // device lost a param
    node.applyNodeConfig(resync);

    expect(node.devices[0].params).toHaveLength(1);
    // Passed config.params win after rebuild.
    expect(node.devices[0].params[0].value).toBe(true);
  });

  it("adopts config params for keys with no live value yet", () => {
    const node = new ESPRMNeoNode(
      { node_id: NODE_ID, devices: [], services: [] } as NodeConfigAPI,
      GROUP_ID
    );

    node.applyNodeConfig(fullConfig());

    const [device] = node.devices;
    expect(device.params.find((p) => p.id === "Power")!.value).toBe(true);
    expect(device.params.find((p) => p.id === "Brightness")!.value).toBe(80);
  });
});

describe("ESPRMNeoNode.setTransportOrder", () => {
  it("replaces the per-node order with a copy", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);
    const order = ["local", "mqtt"];

    node.setTransportOrder(order);
    order.push("mutated");

    expect(node.transportOrder).toEqual(["local", "mqtt"]);
  });

  it("rejects an empty order", () => {
    const node = new ESPRMNeoNode(fullConfig(), GROUP_ID);

    expect(() => node.setTransportOrder([])).toThrow(
      configErrorMessages.INVALID_TRANSPORT_ORDER
    );
  });
});
