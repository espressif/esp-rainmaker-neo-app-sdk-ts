/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

jest.mock("../../src/ESPRMNeoBase", () => ({
  ESPRMNeoBase: { getLocalDiscoveryAdapter: jest.fn() },
}));

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPDiscoveryManager } from "../../src/services/ESPTransport/ESPDiscovery/ESPDiscoveryManager";
import { ESPDiscoveryProtocol } from "../../src/types/discovery";
import { ServiceType } from "../../src/utils/constants";

const getAdapter = ESPRMNeoBase.getLocalDiscoveryAdapter as jest.Mock;

function setAdapter(over: Record<string, jest.Mock> = {}) {
  const adapter = { startDiscovery: jest.fn(), stopDiscovery: jest.fn(), ...over };
  getAdapter.mockReturnValue(adapter);
  return adapter;
}

describe("ESPDiscoveryManager", () => {
  beforeEach(() => {
    getAdapter.mockReset();
  });

  it("throws when no local discovery adapter is configured", () => {
    expect(() => new ESPDiscoveryManager()).toThrow(/ESPLocalDiscoveryAdapter not set/);
  });

  it("defaults to the RainMaker Neo local mDNS discovery params", () => {
    setAdapter();
    const mgr = new ESPDiscoveryManager();
    expect(mgr.params).toEqual({
      serviceType: ServiceType.ESP_RMAKER_LOCAL_CTRL_TCP,
      domain: ESPDiscoveryProtocol.local,
    });
  });

  it("uses a custom discovery config when provided", () => {
    setAdapter();
    const config = { serviceType: "_custom._tcp.", domain: "site" };
    const mgr = new ESPDiscoveryManager(config);
    expect(mgr.params).toEqual(config);
  });

  it("startDiscovery / stopDiscovery delegate to the adapter", () => {
    const adapter = setAdapter();
    const mgr = new ESPDiscoveryManager();
    const cb = jest.fn();

    mgr.startDiscovery(cb);
    expect(adapter.startDiscovery).toHaveBeenCalledWith(cb, mgr.params);

    mgr.stopDiscovery();
    expect(adapter.stopDiscovery).toHaveBeenCalledTimes(1);
  });
});
