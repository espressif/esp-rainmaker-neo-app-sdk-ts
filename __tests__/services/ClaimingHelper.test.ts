/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cloud-boundary tests for assisted claiming: what the SDK puts on the wire for
 * `/v1/claim/initiate` and `/v1/claim/verify`, and how it resolves the broker
 * host the device is given.
 */

import { ClaimingHelper } from "../../src/services/ESPRMNeoHelpers/ClaimingHelper";
import { ESPClaimError } from "../../src/utils/error/ESPClaimError";
import { ClaimCapabilities, ClaimEndpoints } from "../../src/utils/constants";
import { MockHttpError } from "../../test-utils/mock-server";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";

const MAC = "AABBCCDDEEFF";
const NODE_ID = "A1B2C3D4E5F60718";
const CERTIFICATE =
  "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";
const CSR =
  "-----BEGIN CERTIFICATE REQUEST-----\nMIIB\n-----END CERTIFICATE REQUEST-----\n";
/** From DEFAULT_TEST_CONFIG in the harness. */
const CONFIGURED_IOT_ENDPOINT = "test-iot.local";

describe("ClaimingHelper", () => {
  const harness = setupSdkTest();

  const lastBody = () =>
    harness.api.calls[harness.api.calls.length - 1].data as Record<
      string,
      unknown
    >;

  describe("normalizeMacAddress", () => {
    it.each([
      ["aa:bb:cc:dd:ee:ff", "AABBCCDDEEFF"],
      ["AA-BB-CC-DD-EE-FF", "AABBCCDDEEFF"],
      ["aabb.ccdd.eeff", "AABBCCDDEEFF"],
      ["  aabbccddeeff  ", "AABBCCDDEEFF"],
      ["A1B2C3D4E5F60718", "A1B2C3D4E5F60718"],
    ])("normalizes %s to %s", (raw, expected) => {
      expect(ClaimingHelper.normalizeMacAddress(raw)).toBe(expected);
    });

    it.each([
      ["aa:bb:cc", "too short"],
      ["AABBCCDDEEFFAA", "14 characters, neither 12 nor 16"],
      ["ZZBBCCDDEEFF", "non-hex"],
      ["", "empty"],
    ])("rejects %s (%s)", (raw) => {
      expect(() => ClaimingHelper.normalizeMacAddress(raw)).toThrow(
        ESPClaimError
      );
    });
  });

  describe("normalizeMqttHost", () => {
    it.each([
      ["broker.iot.example.com", "broker.iot.example.com"],
      ["mqtts://broker.iot.example.com:8883", "broker.iot.example.com"],
      ["mqtt://broker.iot.example.com", "broker.iot.example.com"],
      ["https://broker.iot.example.com/", "broker.iot.example.com"],
      ["wss://broker.iot.example.com:443/mqtt", "broker.iot.example.com"],
      ["broker.iot.example.com:8883", "broker.iot.example.com"],
    ])("reduces %s to a bare host", (raw, expected) => {
      expect(ClaimingHelper.normalizeMqttHost(raw)).toBe(expected);
    });

    it("returns empty when nothing usable remains", () => {
      expect(ClaimingHelper.normalizeMqttHost("https://")).toBe("");
      expect(ClaimingHelper.normalizeMqttHost("   ")).toBe("");
    });
  });

  describe("initiateClaim", () => {
    it("posts the normalized MAC to the initiate route", async () => {
      harness.api.respond("POST", ClaimEndpoints.CLAIM_INITIATE, {
        node_id: NODE_ID,
      });

      const response = await ClaimingHelper.initiateClaim("aa:bb:cc:dd:ee:ff");

      expect(response.node_id).toBe(NODE_ID);
      expect(harness.api.calls).toHaveLength(1);
      expect(harness.api.calls[0].method).toBe("POST");
      expect(harness.api.calls[0].path).toBe(ClaimEndpoints.CLAIM_INITIATE);
      expect(lastBody()).toEqual({ mac_addr: MAC });
    });

    it("forwards the device's claim-start fields alongside the MAC", async () => {
      harness.api.respond("POST", ClaimEndpoints.CLAIM_INITIATE, {
        node_id: NODE_ID,
      });

      await ClaimingHelper.initiateClaim(MAC, {
        mac_addr: "aa:bb:cc:dd:ee:ff",
        platform: "esp32c3",
      });

      // `platform` survives, and the normalized MAC wins over the device's raw one.
      expect(lastBody()).toEqual({ mac_addr: MAC, platform: "esp32c3" });
    });

    it("fails when the service returns no node_id", async () => {
      harness.api.respond("POST", ClaimEndpoints.CLAIM_INITIATE, {});

      await expect(ClaimingHelper.initiateClaim(MAC)).rejects.toThrow(
        /no node_id/
      );
    });

    it("surfaces the service's message on an HTTP failure", async () => {
      harness.api.on("POST", ClaimEndpoints.CLAIM_INITIATE, () => {
        throw new MockHttpError(403, "Forbidden", {
          message: "node quota reached (max 5)",
        });
      });

      await expect(ClaimingHelper.initiateClaim(MAC)).rejects.toThrow(
        /HTTP 403: node quota reached \(max 5\)/
      );
    });

    it("rejects an invalid MAC before making any call", async () => {
      await expect(ClaimingHelper.initiateClaim("nope")).rejects.toThrow(
        ESPClaimError
      );
      expect(harness.api.calls).toHaveLength(0);
    });
  });

  describe("verifyClaim", () => {
    const verifyResponse = (extra: Record<string, unknown> = {}) => ({
      node_id: NODE_ID,
      certificate: CERTIFICATE,
      ca_certificate:
        "-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----\n",
      ...extra,
    });

    it("forwards the device payload whole, including its request flags", async () => {
      harness.api.respond(
        "POST",
        ClaimEndpoints.CLAIM_VERIFY,
        verifyResponse()
      );

      await ClaimingHelper.verifyClaim(MAC, {
        csr: CSR,
        send_mqtt_host: true,
      });

      // send_mqtt_host must survive: dropping it is how the device silently
      // loses its broker host.
      expect(lastBody()).toEqual({
        mac_addr: MAC,
        csr: CSR,
        send_mqtt_host: true,
      });
    });

    it("normalizes the MAC and does not let the device payload shadow it", async () => {
      harness.api.respond(
        "POST",
        ClaimEndpoints.CLAIM_VERIFY,
        verifyResponse()
      );

      await ClaimingHelper.verifyClaim("aa:bb:cc:dd:ee:ff", {
        csr: CSR,
        mac_addr: "raw-value",
      });

      expect(lastBody().mac_addr).toBe(MAC);
    });

    it("omits capabilities when the requested one has no mapped policies", async () => {
      harness.api.respond(
        "POST",
        ClaimEndpoints.CLAIM_VERIFY,
        verifyResponse()
      );

      await ClaimingHelper.verifyClaim(
        MAC,
        { csr: CSR },
        ClaimCapabilities.CAMERA_CLAIM
      );

      // Sending an unconfirmed policy set would attach the wrong IoT policies.
      expect(lastBody()).not.toHaveProperty("capabilities");
    });

    it("fails when no certificate is returned", async () => {
      harness.api.respond("POST", ClaimEndpoints.CLAIM_VERIFY, {
        node_id: NODE_ID,
      });

      await expect(
        ClaimingHelper.verifyClaim(MAC, { csr: CSR })
      ).rejects.toThrow(/missing certificate/);
    });

    it("surfaces the service's message on an HTTP failure", async () => {
      harness.api.on("POST", ClaimEndpoints.CLAIM_VERIFY, () => {
        throw new MockHttpError(400, "Bad Request", { message: "invalid csr" });
      });

      await expect(
        ClaimingHelper.verifyClaim(MAC, { csr: CSR })
      ).rejects.toThrow(/HTTP 400: invalid csr/);
    });

    describe("mqtt_host resolution", () => {
      it("falls back to the configured iotEndpoint, which is the normal path", async () => {
        harness.api.respond(
          "POST",
          ClaimEndpoints.CLAIM_VERIFY,
          verifyResponse()
        );

        const response = await ClaimingHelper.verifyClaim(MAC, { csr: CSR });

        expect(response.mqtt_host).toBe(CONFIGURED_IOT_ENDPOINT);
      });

      it("prefers a host returned by the service", async () => {
        harness.api.respond(
          "POST",
          ClaimEndpoints.CLAIM_VERIFY,
          verifyResponse({ mqtt_host: "service.iot.example.com" })
        );

        const response = await ClaimingHelper.verifyClaim(MAC, { csr: CSR });

        expect(response.mqtt_host).toBe("service.iot.example.com");
      });

      it("normalizes a service host that arrives as a URL", async () => {
        harness.api.respond(
          "POST",
          ClaimEndpoints.CLAIM_VERIFY,
          verifyResponse({ mqtt_host: "mqtts://service.iot.example.com:8883" })
        );

        const response = await ClaimingHelper.verifyClaim(MAC, { csr: CSR });

        expect(response.mqtt_host).toBe("service.iot.example.com");
      });

      it("preserves the rest of the response so the device still gets it", async () => {
        harness.api.respond(
          "POST",
          ClaimEndpoints.CLAIM_VERIFY,
          verifyResponse({ mqtt_cred_host: "creds.iot.example.com" })
        );

        const response = await ClaimingHelper.verifyClaim(MAC, { csr: CSR });

        expect(response.node_id).toBe(NODE_ID);
        expect(response.certificate).toBe(CERTIFICATE);
        expect(response.ca_certificate).toContain("BEGIN CERTIFICATE");
        expect(response.mqtt_cred_host).toBe("creds.iot.example.com");
      });
    });
  });

  describe("when the deployment has no iotEndpoint", () => {
    const noEndpoint = setupSdkTest({ config: { iotEndpoint: "" } });

    it("fails rather than handing the device an empty host", async () => {
      noEndpoint.api.respond("POST", ClaimEndpoints.CLAIM_VERIFY, {
        node_id: NODE_ID,
        certificate: CERTIFICATE,
      });

      await expect(
        ClaimingHelper.verifyClaim(MAC, { csr: CSR })
      ).rejects.toThrow(/no mqtt_host available/);
    });
  });
});
