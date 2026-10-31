/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A node whose data model a satellite SDK declared shadowless has no AWS IoT
 * shadow, so the constructor must not register it for MQTT — otherwise every
 * construction fires a shadow GET that comes back 404. Nodes with no data
 * model, or an undeclared one, must still register, so the gate is asserted
 * from both sides.
 */

jest.mock("../../src/services/NodeMQTTOrchestrator", () => ({
  NodeMQTTOrchestrator: {
    registerNode: jest.fn(),
    unregisterNode: jest.fn(),
    isNodeRegistered: jest.fn(),
    subscribeToNode: jest.fn(),
    unsubscribeFromNode: jest.fn(),
    getShadow: jest.fn(),
    getParams: jest.fn().mockResolvedValue(undefined),
  },
}));

import { NodeMQTTOrchestrator } from "../../src/services/NodeMQTTOrchestrator";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPRMNeoNode } from "../../src/ESPRMNeoNode";
import { NodeConfigAPI } from "../../src/types/output";

setupSdkTest();

const GROUP_ID = "grp-shadowless";
const NODE_ID = "7F516E43C3AF4143";
const SHADOWLESS_MODEL = "satellite-owned-model";

const registerNode = NodeMQTTOrchestrator.registerNode as jest.Mock;

function baseConfig(): NodeConfigAPI {
  return { node_id: NODE_ID, devices: [], services: [] };
}

describe("[Unit Test]: ESPRMNeoNode shadowless data model gate", () => {
  beforeEach(() => {
    registerNode.mockClear();
  });

  test("skips MQTT registration once the data model is declared shadowless", () => {
    ESPRMNeoBase.registerShadowlessDataModel(SHADOWLESS_MODEL);
    new ESPRMNeoNode(
      { ...baseConfig(), data_model: SHADOWLESS_MODEL },
      GROUP_ID
    );
    expect(registerNode).not.toHaveBeenCalled();
  });

  test("registers a node that carries no data model", () => {
    new ESPRMNeoNode(baseConfig(), GROUP_ID);
    expect(registerNode).toHaveBeenCalledWith(NODE_ID, `params-${GROUP_ID}`);
  });

  test("registers a node whose data model was never declared shadowless", () => {
    new ESPRMNeoNode({ ...baseConfig(), data_model: "undeclared" }, GROUP_ID);
    expect(registerNode).toHaveBeenCalledWith(NODE_ID, `params-${GROUP_ID}`);
  });

  test("isShadowlessDataModel is false for undefined and undeclared models", () => {
    expect(ESPRMNeoBase.isShadowlessDataModel(undefined)).toBe(false);
    expect(ESPRMNeoBase.isShadowlessDataModel("undeclared")).toBe(false);
    expect(ESPRMNeoBase.isShadowlessDataModel(SHADOWLESS_MODEL)).toBe(true);
  });
});
