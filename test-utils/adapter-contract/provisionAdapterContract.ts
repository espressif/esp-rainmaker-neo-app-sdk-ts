/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="jest" />

import type { ProvisionAdapter } from "./ProvisionAdapter";

export interface ProvisionContractOptions {
  /**
   * The id and name prefix of a device the adapter's scan() is guaranteed to
   * surface. Defaults to the prefix used by {@link MockProvisionAdapter}.
   */
  knownDevicePrefix?: string;
  /** An id that scan() will never return, used for negative connect() tests. */
  unknownDeviceId?: string;
}

/**
 * Shared behavioural contract for any {@link ProvisionAdapter}.
 *
 * Call this from a test file once per implementation:
 *
 *   runProvisionAdapterContract("Mock", () => new MockProvisionAdapter());
 *   runProvisionAdapterContract("Android", () => new AndroidProvisionAdapter());
 *
 * Every adapter — mock, Android, iOS, Web — must make these expectations pass,
 * guaranteeing the SDK can treat them interchangeably.
 *
 * `createAdapter` is a factory so each test gets a fresh, isolated instance.
 */
export function runProvisionAdapterContract(
  name: string,
  createAdapter: () => ProvisionAdapter | Promise<ProvisionAdapter>,
  options: ProvisionContractOptions = {}
): void {
  const prefix = options.knownDevicePrefix ?? "PROV_";
  const unknownId = options.unknownDeviceId ?? "DOES_NOT_EXIST";

  describe(`ProvisionAdapter contract: ${name}`, () => {
    let adapter: ProvisionAdapter;

    beforeEach(async () => {
      adapter = await createAdapter();
    });

    afterEach(async () => {
      // Adapters must tolerate disconnect() even when never connected.
      await adapter.disconnect();
    });

    describe("scan()", () => {
      it("resolves to an array of well-formed devices", async () => {
        const devices = await adapter.scan();
        expect(Array.isArray(devices)).toBe(true);
        for (const d of devices) {
          expect(typeof d.id).toBe("string");
          expect(d.id.length).toBeGreaterThan(0);
          expect(typeof d.name).toBe("string");
          expect(["ble", "softap"]).toContain(d.transport);
        }
      });

      it("surfaces at least one device matching the known prefix", async () => {
        const devices = await adapter.scan({ prefix });
        expect(devices.length).toBeGreaterThan(0);
        for (const d of devices) {
          expect(d.name.startsWith(prefix)).toBe(true);
        }
      });
    });

    describe("connect()", () => {
      it("connects to a discovered device", async () => {
        const [device] = await adapter.scan({ prefix });
        const result = await adapter.connect(device.id);
        expect(result.connected).toBe(true);
        expect(result.deviceId).toBe(device.id);
      });

      it("rejects connecting to an unknown device", async () => {
        await expect(adapter.connect(unknownId)).rejects.toThrow();
      });
    });

    describe("provision()", () => {
      it("requires a prior connect()", async () => {
        await expect(
          adapter.provision({ ssid: "Home-WiFi", passphrase: "secret" })
        ).rejects.toThrow();
      });

      it("provisions a connected device and returns a node id", async () => {
        const [device] = await adapter.scan({ prefix });
        await adapter.connect(device.id, { proofOfPossession: "abcd1234" });
        const result = await adapter.provision({
          ssid: "Home-WiFi",
          passphrase: "secret",
        });
        expect(result.success).toBe(true);
        expect(typeof result.nodeId).toBe("string");
        expect(result.nodeId && result.nodeId.length).toBeGreaterThan(0);
      });

      it("rejects an empty ssid", async () => {
        const [device] = await adapter.scan({ prefix });
        await adapter.connect(device.id);
        await expect(adapter.provision({ ssid: "" })).rejects.toThrow();
      });
    });

    describe("lifecycle", () => {
      it("cannot provision after disconnect()", async () => {
        const [device] = await adapter.scan({ prefix });
        await adapter.connect(device.id);
        await adapter.disconnect();
        await expect(
          adapter.provision({ ssid: "Home-WiFi" })
        ).rejects.toThrow();
      });
    });
  });
}
