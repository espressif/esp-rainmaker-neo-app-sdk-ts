/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for the integrations trio (landed on
 * `version-1`): `listIntegrations`, `registerIntegrationEndpoint`,
 * `unregisterIntegrationEndpoint`.
 *
 * Responses are spec-pinned via `validated()` (`ListPublicIntegrationsResponse`,
 * `RegisterEndpointResponse`, `SuccessResponse`); the PUT body auto-validates
 * against `request:PUT /v1/integrations/{integrationId}/endpoints` in the
 * mock server. Off-spec payloads the SDK deliberately tolerates
 * (bare array, missing fields) are raw fixtures with inline notes.
 */

import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { validated } from "../../test-utils/response-builder";
import type { ESPRMNeoUser } from "../../src/ESPRMNeoUser";

const h = setupSdkTest();

const INTEGRATIONS = "/v1/integrations";
const endpointsOf = (id: string) => `/v1/integrations/${id}/endpoints`;
const endpointOf = (id: string, ep: string) =>
  `/v1/integrations/${id}/endpoints/${ep}`;

function makeUser(): ESPRMNeoUser {
  return h.user();
}

// ===========================================================================
// listIntegrations()
// ===========================================================================
describe("ESPRMNeoUser.listIntegrations", () => {
  it("happy path: GETs /v1/integrations and unwraps the integrations array", async () => {
    h.api.respond(
      "GET",
      INTEGRATIONS,
      validated("ListPublicIntegrationsResponse", {
        integrations: [
          { integration_id: "apns_com.company.app", integration_type: "apns" },
          { integration_id: "gcm_fcm-project-id", integration_type: "gcm" },
        ],
      })
    );

    const result = await makeUser().listIntegrations();

    const calls = h.api.callsTo("GET", INTEGRATIONS);
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(INTEGRATIONS);
    expect(result).toEqual([
      { integration_id: "apns_com.company.app", integration_type: "apns" },
      { integration_id: "gcm_fcm-project-id", integration_type: "gcm" },
    ]);
  });

  it("returns an empty array for an empty listing", async () => {
    h.api.respond(
      "GET",
      INTEGRATIONS,
      validated("ListPublicIntegrationsResponse", { integrations: [] })
    );

    expect(await makeUser().listIntegrations()).toEqual([]);
  });

  it("tolerates a bare-array response (off-spec defensive branch)", async () => {
    // The SDK accepts a top-level array even though the spec wraps the list
    // in `{ integrations }` — deliberately unvalidated.
    h.api.respond("GET", INTEGRATIONS, [
      { integration_id: "apns_x", integration_type: "apns" },
    ]);

    expect(await makeUser().listIntegrations()).toEqual([
      { integration_id: "apns_x", integration_type: "apns" },
    ]);
  });

  it("returns [] when the object response lacks `integrations` (off-spec)", async () => {
    h.api.respond("GET", INTEGRATIONS, {});

    expect(await makeUser().listIntegrations()).toEqual([]);
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("GET", INTEGRATIONS, 500);

    await expect(makeUser().listIntegrations()).rejects.toThrow(
      "HTTP error! status: 500"
    );
  });
});

// ===========================================================================
// registerIntegrationEndpoint()
// ===========================================================================
describe("ESPRMNeoUser.registerIntegrationEndpoint", () => {
  const RESPONSE = validated("RegisterEndpointResponse", {
    status: "success",
    endpoint_id: "arn:aws:sns:us-east-1:123:endpoint/APNS/App/abc-123",
  });

  it("happy path: PUTs the delivery credentials and returns endpoint_id", async () => {
    h.api.respond("PUT", endpointsOf("apns_com.company.app"), RESPONSE);

    const endpointId = await makeUser().registerIntegrationEndpoint(
      "apns_com.company.app",
      "<device-token>",
      "en_US"
    );

    const [call] = h.api.callsTo("PUT", endpointsOf("apns_com.company.app"));
    expect(call.data).toEqual({
      delivery_credentials: { app_token: "<device-token>" },
      locale: "en_US",
    });
    expect(endpointId).toBe(
      "arn:aws:sns:us-east-1:123:endpoint/APNS/App/abc-123"
    );
  });

  it("omits `locale` from the body when not provided", async () => {
    h.api.respond("PUT", endpointsOf("gcm_project"), RESPONSE);

    await makeUser().registerIntegrationEndpoint("gcm_project", "<fcm-token>");

    const [call] = h.api.callsTo("PUT", endpointsOf("gcm_project"));
    expect(call.data).toEqual({
      delivery_credentials: { app_token: "<fcm-token>" },
    });
  });

  it("URL-encodes the integrationId path segment", async () => {
    h.api.respond("PUT", "/v1/integrations/:integrationId/endpoints", RESPONSE);

    await makeUser().registerIntegrationEndpoint("apns id/slash", "<tok>");

    const [call] = h.api.callsTo(
      "PUT",
      "/v1/integrations/:integrationId/endpoints"
    );
    expect(call.path).toBe("/v1/integrations/apns%20id%2Fslash/endpoints");
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("PUT", endpointsOf("apns_x"), 400);

    await expect(
      makeUser().registerIntegrationEndpoint("apns_x", "<tok>")
    ).rejects.toThrow("HTTP error! status: 400");
  });
});

// ===========================================================================
// unregisterIntegrationEndpoint()
// ===========================================================================
describe("ESPRMNeoUser.unregisterIntegrationEndpoint", () => {
  it("happy path: DELETEs the endpoint and returns the server message", async () => {
    h.api.respond(
      "DELETE",
      endpointOf("apns_x", "ep-1"),
      validated("SuccessResponse", { message: "Endpoint deleted" })
    );

    const result = await makeUser().unregisterIntegrationEndpoint(
      "apns_x",
      "ep-1"
    );

    const calls = h.api.callsTo("DELETE", endpointOf("apns_x", "ep-1"));
    expect(calls).toHaveLength(1);
    expect(result).toEqual({ message: "Endpoint deleted" });
  });

  it("falls back to the SDK success message when the response is empty (off-spec)", async () => {
    // Spec requires `message`; the SDK normalizes an empty body instead of
    // failing — deliberately unvalidated.
    h.api.respond("DELETE", endpointOf("apns_x", "ep-1"), {});

    const result = await makeUser().unregisterIntegrationEndpoint(
      "apns_x",
      "ep-1"
    );

    expect(result).toEqual({ message: "Endpoint unregistered successfully" });
  });

  it("URL-encodes both path segments", async () => {
    h.api.respond(
      "DELETE",
      "/v1/integrations/:integrationId/endpoints/:endpointId",
      validated("SuccessResponse", { message: "ok" })
    );

    await makeUser().unregisterIntegrationEndpoint("a/b", "arn:x:y");

    const [call] = h.api.callsTo(
      "DELETE",
      "/v1/integrations/:integrationId/endpoints/:endpointId"
    );
    expect(call.path).toBe("/v1/integrations/a%2Fb/endpoints/arn%3Ax%3Ay");
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("DELETE", endpointOf("apns_x", "ep-1"), 500);

    await expect(
      makeUser().unregisterIntegrationEndpoint("apns_x", "ep-1")
    ).rejects.toThrow("HTTP error! status: 500");
  });
});
