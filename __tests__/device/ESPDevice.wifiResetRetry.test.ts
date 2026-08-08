/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPDevice } from "../../src/ESPDevice";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import {
  ESPProvisionAdapterInterface,
  ESPProvResponseStatus,
} from "../../src/types/provision";
import { ESPProvProgressMessages } from "../../src/utils/constants";
import { ESPProvError } from "../../src/utils/error/ESPProvError";
import {
  DEFAULT_NODE_ONLINE_TIMEOUT_MS,
  waitForNodeOnline,
} from "../../src/utils/waitForNodeOnline";

// Load only the method extensions under test (plus setNetworkCredentials,
// which retryNetworkCredentials delegates to).
import "../../src/methods/ESPDevice/SetNetworkCredentials";
import "../../src/methods/ESPDevice/ResetWifiStatus";
import "../../src/methods/ESPDevice/RetryNetworkCredentials";

jest.mock("../../src/ESPRMNeoBase");

// Replace the online-wait module entirely; the real one drags in MQTT machinery.
jest.mock("../../src/utils/waitForNodeOnline", () => ({
  DEFAULT_NODE_ONLINE_TIMEOUT_MS: 120_000,
  waitForNodeOnline: jest.fn(),
}));

function createMockAdapter(
  overrides: Partial<ESPProvisionAdapterInterface> = {}
): ESPProvisionAdapterInterface {
  return {
    searchESPDevices: jest.fn(),
    stopESPDevicesSearch: jest.fn(),
    createESPDevice: jest.fn(),
    connect: jest.fn(),
    getDeviceCapabilities: jest.fn(),
    getDeviceVersion: jest.fn(),
    setProofOfPossession: jest.fn(),
    initializeSession: jest.fn(),
    scanWifiList: jest.fn(),
    sendData: jest.fn(),
    provision: jest.fn(),
    disconnect: jest.fn(),
    resetWifiStatus: jest.fn(),
    ...overrides,
  } as unknown as ESPProvisionAdapterInterface;
}

function createDevice(
  adapter: ESPProvisionAdapterInterface
): ESPDevice {
  (ESPRMNeoBase.getProvisionAdapter as jest.Mock).mockReturnValue(adapter);
  return new ESPDevice({
    name: "Test Device",
    transport: "ble",
    security: 0,
    capabilities: ["wifi"],
    sendData: jest.fn(),
  } as any);
}

describe("ESPDevice Wi-Fi reset and provisioning retry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("resetWifiStatus", () => {
    it("asks the adapter to reset and resolves with its acknowledgement", async () => {
      const adapter = createMockAdapter();
      (adapter.resetWifiStatus as jest.Mock).mockResolvedValue(true);
      const device = createDevice(adapter);

      await expect(device.resetWifiStatus()).resolves.toBe(true);
      expect(adapter.resetWifiStatus).toHaveBeenCalledWith(device.name);
    });

    it("passes through a negative acknowledgement", async () => {
      const adapter = createMockAdapter();
      (adapter.resetWifiStatus as jest.Mock).mockResolvedValue(false);
      const device = createDevice(adapter);

      await expect(device.resetWifiStatus()).resolves.toBe(false);
    });

    it("resolves false without throwing when the adapter predates resetWifiStatus", async () => {
      const adapter = createMockAdapter({ resetWifiStatus: undefined });
      const device = createDevice(adapter);

      await expect(device.resetWifiStatus()).resolves.toBe(false);
    });

    it("rethrows when the adapter fails to reset", async () => {
      const adapter = createMockAdapter();
      (adapter.resetWifiStatus as jest.Mock).mockRejectedValue(
        new Error("BLE write failed")
      );
      const device = createDevice(adapter);

      await expect(device.resetWifiStatus()).rejects.toThrow(
        "BLE write failed"
      );
    });
  });

  describe("retryNetworkCredentials", () => {
    it("refuses to retry before any association has completed", async () => {
      const adapter = createMockAdapter();
      const device = createDevice(adapter);
      const onProgress = jest.fn();

      await expect(
        device.retryNetworkCredentials("Home-WiFi", "secret", onProgress)
      ).rejects.toThrow(ESPProvError);
      expect(adapter.provision).not.toHaveBeenCalled();
      expect(onProgress).not.toHaveBeenCalled();
    });

    it("re-sends credentials and resolves with the node id from the first attempt", async () => {
      const adapter = createMockAdapter();
      (adapter.provision as jest.Mock).mockResolvedValue(0);
      const device = createDevice(adapter);
      device.provisionResumeState = {
        nodeId: "node-123",
        groupId: "group-456",
      };
      const onProgress = jest.fn();

      const nodeId = await device.retryNetworkCredentials(
        "Home-WiFi",
        "corrected-pass",
        onProgress
      );

      expect(adapter.provision).toHaveBeenCalledWith(
        device.name,
        "Home-WiFi",
        "corrected-pass"
      );
      expect(nodeId).toBe("node-123");
      expect(waitForNodeOnline).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenNthCalledWith(1, {
        status: ESPProvResponseStatus.onProgress,
        description: ESPProvProgressMessages.SETTING_NETWORK_CREDENTIALS,
      });
      expect(onProgress).toHaveBeenLastCalledWith({
        status: ESPProvResponseStatus.succeed,
        description: "node-123",
      });
    });

    it("waits for the node to come online when the original provision asked for it", async () => {
      const adapter = createMockAdapter();
      (adapter.provision as jest.Mock).mockResolvedValue(0);
      (waitForNodeOnline as jest.Mock).mockResolvedValue(undefined);
      const device = createDevice(adapter);
      const user = { userId: "user-1" };
      device.provisionResumeState = {
        nodeId: "node-123",
        groupId: "group-456",
        options: { waitForOnline: true, user, onlineTimeoutMs: 5_000 },
      };
      const onProgress = jest.fn();

      await device.retryNetworkCredentials("Home-WiFi", "pass", onProgress);

      expect(waitForNodeOnline).toHaveBeenCalledWith({
        nodeId: "node-123",
        groupId: "group-456",
        user,
        timeoutMs: 5_000,
      });
      expect(onProgress).toHaveBeenCalledWith({
        status: ESPProvResponseStatus.onProgress,
        description: ESPProvProgressMessages.WAITING_FOR_ONLINE,
      });
    });

    it("falls back to the default online timeout when none was given", async () => {
      const adapter = createMockAdapter();
      (adapter.provision as jest.Mock).mockResolvedValue(0);
      (waitForNodeOnline as jest.Mock).mockResolvedValue(undefined);
      const device = createDevice(adapter);
      const user = { userId: "user-1" };
      device.provisionResumeState = {
        nodeId: "node-123",
        groupId: "group-456",
        options: { waitForOnline: true, user },
      };

      await device.retryNetworkCredentials("Home-WiFi", "pass", jest.fn());

      expect(waitForNodeOnline).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: DEFAULT_NODE_ONLINE_TIMEOUT_MS })
      );
    });

    it("skips the online wait when the original options carried no user", async () => {
      const adapter = createMockAdapter();
      (adapter.provision as jest.Mock).mockResolvedValue(0);
      const device = createDevice(adapter);
      device.provisionResumeState = {
        nodeId: "node-123",
        groupId: "group-456",
        options: { waitForOnline: true },
      };

      await expect(
        device.retryNetworkCredentials("Home-WiFi", "pass", jest.fn())
      ).resolves.toBe("node-123");
      expect(waitForNodeOnline).not.toHaveBeenCalled();
    });

    it("propagates a credential-set failure and keeps the resume state for another retry", async () => {
      const adapter = createMockAdapter();
      (adapter.provision as jest.Mock).mockRejectedValue(
        new Error("Credential write failed")
      );
      const device = createDevice(adapter);
      device.provisionResumeState = {
        nodeId: "node-123",
        groupId: "group-456",
      };
      const onProgress = jest.fn();

      await expect(
        device.retryNetworkCredentials("Home-WiFi", "pass", onProgress)
      ).rejects.toThrow("Credential write failed");

      expect(device.provisionResumeState).toBeDefined();
      expect(onProgress).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: ESPProvResponseStatus.succeed })
      );
    });
  });
});
