/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * End-to-end tests for the assisted-claiming orchestration: the BLE exchange with
 * the device is driven by a simulator keyed on message type, and the two cloud
 * calls go through the harness mock server.
 */

import { ESPDevice } from "../../src/ESPDevice";
import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import {
  RMakerClaimMsgType,
  RMakerClaimStatus,
} from "../../src/proto/esp_rmaker_claim";
import {
  ClaimEndpoints,
  ClaimErrorCodes,
  ClaimProgressMessages,
} from "../../src/utils/constants";
import { ESPClaimStatus } from "../../src/types/provision";
import type { ESPClaimResponse } from "../../src/types/provision";
import { MockHttpError } from "../../test-utils/mock-server";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import {
  createDeviceSimulator,
  DEFAULT_CSR_PAYLOAD,
  type DeviceSimulator,
  type DeviceSimulatorOptions,
} from "../helpers/claiming/deviceSimulator";

const NODE_ID = "A1B2C3D4E5F60718";
const CERTIFICATE =
  "-----BEGIN CERTIFICATE-----\n" +
  "c".repeat(900) +
  "\n-----END CERTIFICATE-----\n";
/** From DEFAULT_TEST_CONFIG in the harness. */
const CONFIGURED_IOT_ENDPOINT = "test-iot.local";
const MAX_FRAGMENT = 200;

describe("ESPDevice.startAssistedClaiming", () => {
  const harness = setupSdkTest();

  let device: ESPDevice;
  let simulator: DeviceSimulator;
  let progress: ESPClaimResponse[];

  /** Wires a fresh simulator as the provision adapter and returns it. */
  const useDevice = (options: DeviceSimulatorOptions = {}): DeviceSimulator => {
    simulator = createDeviceSimulator(options);
    jest
      .spyOn(ESPRMNeoBase, "getProvisionAdapter")
      .mockReturnValue({ sendData: simulator.sendData } as never);
    return simulator;
  };

  const stubCloud = (
    verifyBody: Record<string, unknown> = {
      node_id: NODE_ID,
      certificate: CERTIFICATE,
    }
  ) => {
    harness.api.respond("POST", ClaimEndpoints.CLAIM_INITIATE, {
      node_id: NODE_ID,
    });
    harness.api.respond("POST", ClaimEndpoints.CLAIM_VERIFY, verifyBody);
  };

  const onProgress = (response: ESPClaimResponse) => {
    progress.push(response);
  };

  beforeEach(() => {
    progress = [];
    device = new ESPDevice({
      name: "PROV_abc123",
      transport: "ble",
      security: 2,
    } as never);
    useDevice();
  });

  describe("happy path", () => {
    beforeEach(() => stubCloud());

    it("completes the exchange in protocol order", async () => {
      await device.startAssistedClaiming(onProgress);

      expect(simulator.received).toEqual([
        RMakerClaimMsgType.TypeCmdClaimStart,
        // One ClaimInit per CSR fragment: the default CSR is a single fragment.
        RMakerClaimMsgType.TypeCmdClaimInit,
        ...simulator.certificateFragments.map(
          () => RMakerClaimMsgType.TypeCmdClaimVerify
        ),
      ]);
      expect(simulator.wasAborted()).toBe(false);
    });

    it("reports success as the final progress update", async () => {
      await device.startAssistedClaiming(onProgress);

      expect(progress[0]).toEqual({
        status: ESPClaimStatus.inProgress,
        message: ClaimProgressMessages.CLAIM_STARTING,
      });
      expect(progress[progress.length - 1]).toEqual({
        status: ESPClaimStatus.success,
        message: ClaimProgressMessages.CLAIM_SUCCESS,
      });
      expect(
        progress.filter((p) => p.status === ESPClaimStatus.failed)
      ).toHaveLength(0);
    });

    it("sends the device's MAC and CSR flags to the cloud", async () => {
      await device.startAssistedClaiming();

      const [initiate, verify] = harness.api.calls;
      expect(initiate.path).toBe(ClaimEndpoints.CLAIM_INITIATE);
      expect(initiate.data).toEqual({
        mac_addr: "AABBCCDDEEFF",
        platform: "esp32c3",
      });

      expect(verify.path).toBe(ClaimEndpoints.CLAIM_VERIFY);
      expect(verify.data).toMatchObject({
        mac_addr: "AABBCCDDEEFF",
        // Surrounding whitespace is trimmed off the PEM block.
        csr: JSON.parse(DEFAULT_CSR_PAYLOAD).csr.trim(),
        // The flag the device used to ask for its broker host.
        send_mqtt_host: true,
      });
    });

    it("gives the device a certificate payload carrying the broker host", async () => {
      await device.startAssistedClaiming();

      const delivered = JSON.parse(simulator.reassembledCertificate());
      expect(delivered).toEqual({
        node_id: NODE_ID,
        certificate: CERTIFICATE,
        mqtt_host: CONFIGURED_IOT_ENDPOINT,
      });
    });

    it("never exceeds the protocol's fragment ceiling", async () => {
      await device.startAssistedClaiming();

      expect(simulator.certificateFragments.length).toBeGreaterThan(1);
      for (const fragment of simulator.certificateFragments) {
        expect(fragment.payload.length).toBeLessThanOrEqual(MAX_FRAGMENT);
      }
    });

    it("follows the device's own fragment size when it is smaller", async () => {
      // The default CSR arrives as one 110-byte fragment, so that becomes the
      // size the certificate is streamed back in.
      const deviceFragmentSize = DEFAULT_CSR_PAYLOAD.length;
      expect(deviceFragmentSize).toBeLessThan(MAX_FRAGMENT);

      await device.startAssistedClaiming();

      expect(simulator.certificateFragments[0].payload).toHaveLength(
        deviceFragmentSize
      );
      expect(
        simulator.certificateFragments.map((f) => f.offset).slice(0, 3)
      ).toEqual([0, deviceFragmentSize, deviceFragmentSize * 2]);
    });

    it("caps at the ceiling when the device's fragment size is larger", async () => {
      useDevice({ csrPayload: "x".repeat(600), fragmentSize: 400 });
      harness.api.reset();
      stubCloud();

      await device.startAssistedClaiming();

      expect(simulator.certificateFragments[0].payload).toHaveLength(
        MAX_FRAGMENT
      );
    });

    it("prefers a broker host returned by the claiming service", async () => {
      harness.api.reset();
      stubCloud({
        node_id: NODE_ID,
        certificate: CERTIFICATE,
        mqtt_host: "mqtts://service.iot.example.com:8883",
      });

      await device.startAssistedClaiming();

      expect(JSON.parse(simulator.reassembledCertificate()).mqtt_host).toBe(
        "service.iot.example.com"
      );
    });
  });

  describe("chunked CSR", () => {
    it("reassembles a CSR that arrives in several fragments", async () => {
      const csrPayload = JSON.stringify({
        csr:
          "-----BEGIN CERTIFICATE REQUEST-----\n" +
          "r".repeat(500) +
          "\n-----END CERTIFICATE REQUEST-----\n",
        send_mqtt_host: true,
      });
      useDevice({ csrPayload, fragmentSize: 200 });
      stubCloud();

      await device.startAssistedClaiming();

      const initRequests = simulator.received.filter(
        (msg) => msg === RMakerClaimMsgType.TypeCmdClaimInit
      );
      expect(initRequests.length).toBeGreaterThan(1);
      expect(harness.api.calls[1].data).toMatchObject({
        csr: JSON.parse(csrPayload).csr.trim(),
        send_mqtt_host: true,
      });
    });
  });

  describe("failure paths", () => {
    it("fails and aborts when the device rejects ClaimStart", async () => {
      useDevice({ startStatus: RMakerClaimStatus.InvalidState });
      stubCloud();

      await expect(
        device.startAssistedClaiming(onProgress)
      ).rejects.toMatchObject({ code: ClaimErrorCodes.CLAIM_START_FAILED });

      expect(harness.api.calls).toHaveLength(0);
      expect(simulator.wasAborted()).toBe(true);
      expect(progress[progress.length - 1].status).toBe(ESPClaimStatus.failed);
    });

    it("fails when the device reports no MAC address", async () => {
      useDevice({ deviceInfo: JSON.stringify({ platform: "esp32c3" }) });
      stubCloud();

      await expect(device.startAssistedClaiming()).rejects.toMatchObject({
        code: ClaimErrorCodes.DEVICE_MAC_UNAVAILABLE,
      });
      expect(harness.api.calls).toHaveLength(0);
    });

    it("fails when the device rejects the CSR request", async () => {
      useDevice({ csrStatus: RMakerClaimStatus.InvalidState });
      stubCloud();

      await expect(device.startAssistedClaiming()).rejects.toMatchObject({
        code: ClaimErrorCodes.CSR_RETRIEVAL_FAILED,
      });
    });

    it("gives up instead of looping when the device stops advancing the CSR", async () => {
      useDevice({ stallCsr: true });
      stubCloud();

      await expect(device.startAssistedClaiming()).rejects.toMatchObject({
        code: ClaimErrorCodes.CSR_STALLED,
      });
    });

    it("fails before touching the device when the cloud rejects the claim", async () => {
      harness.api.respond("POST", ClaimEndpoints.CLAIM_INITIATE, {
        node_id: NODE_ID,
      });
      harness.api.on("POST", ClaimEndpoints.CLAIM_VERIFY, () => {
        throw new MockHttpError(403, "Forbidden", {
          message: "node not claimed",
        });
      });

      await expect(device.startAssistedClaiming()).rejects.toThrow(
        /HTTP 403: node not claimed/
      );

      // Nothing was streamed, and the device was released.
      expect(simulator.certificateFragments).toHaveLength(0);
      expect(simulator.wasAborted()).toBe(true);
    });

    it("fails when the device rejects a certificate fragment", async () => {
      // A CSR longer than the ceiling pins the certificate fragment size to 200,
      // so the rejected offset is predictable.
      const rejectAt = MAX_FRAGMENT * 2;
      useDevice({
        csrPayload: "x".repeat(600),
        fragmentSize: MAX_FRAGMENT,
        rejectVerifyAtOffset: rejectAt,
      });
      stubCloud();

      await expect(
        device.startAssistedClaiming(onProgress)
      ).rejects.toMatchObject({
        code: ClaimErrorCodes.CERTIFICATE_SEND_FAILED,
      });

      // It stopped at the rejected fragment rather than streaming the rest.
      expect(
        simulator.certificateFragments.every(
          (fragment) => fragment.offset < rejectAt
        )
      ).toBe(true);
      expect(progress[progress.length - 1]).toMatchObject({
        status: ESPClaimStatus.failed,
        message: ClaimProgressMessages.CLAIM_FAILED,
      });
    });

    it("surfaces the failure reason to the progress callback", async () => {
      harness.api.on("POST", ClaimEndpoints.CLAIM_INITIATE, () => {
        throw new MockHttpError(403, "Forbidden", {
          message: "node quota reached (max 5)",
        });
      });

      await expect(device.startAssistedClaiming(onProgress)).rejects.toThrow();

      expect(progress[progress.length - 1].error).toMatch(
        /node quota reached \(max 5\)/
      );
    });

    it("still reports the original failure when the abort also fails", async () => {
      useDevice({ startStatus: RMakerClaimStatus.Fail });
      simulator.sendData.mockImplementationOnce(async () =>
        // ClaimStart answers Fail, then the abort write throws.
        simulator.sendData.getMockImplementation()!(
          "PROV_abc123",
          "rmaker_claim",
          Buffer.from([0x08, 0x00]).toString("base64")
        )
      );
      stubCloud();

      await expect(device.startAssistedClaiming()).rejects.toMatchObject({
        code: ClaimErrorCodes.CLAIM_START_FAILED,
      });
    });
  });

  describe("without a progress callback", () => {
    it("completes without throwing", async () => {
      stubCloud();
      await expect(device.startAssistedClaiming()).resolves.toBeUndefined();
    });
  });
});
