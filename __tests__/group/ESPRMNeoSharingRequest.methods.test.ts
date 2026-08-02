/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit suite for `ESPRMNeoSharingRequest` instance methods.
 *
 * Covers `accept()`, `decline()`, and the constructor field mapping.
 *
 * ★ Runs on the shared SDK test harness: `setupSdkTest()` wires
 * the whole boundary — no per-file `jest.mock` blocks, no method imports.
 * Responses register as routes on `h.api`; faults use `h.api.fail(...)`.
 */

import { validated } from "../../test-utils/response-builder";
import { setupSdkTest } from "../../test-utils/sdk-test-harness";
import { ESPRMNeoSharingRequest } from "../../src/ESPRMNeoSharingRequest";

const h = setupSdkTest();

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const REQUEST_ID = "req-abc-001";

function makeSharingRequest(
  overrides: Partial<{
    sharing_request_id: string;
    group_id: string;
    subgroup_id: string;
    access_type: "primary" | "secondary" | "subentity";
    primary_user_id: string;
    primary_email: string;
    primary_phone_number: string;
  }> = {}
): ESPRMNeoSharingRequest {
  return new ESPRMNeoSharingRequest({
    sharing_request_id: REQUEST_ID,
    group_id: "grp-shared",
    subgroup_id: "",
    access_type: "secondary",
    primary_user_id: "owner-id",
    primary_email: "owner@example.com",
    primary_phone_number: "",
    ...overrides,
  });
}

// ===========================================================================
// accept() — POST /v1/sharing-requests/{requestId}/accept
// ===========================================================================
describe("ESPRMNeoSharingRequest.accept", () => {
  it("happy path: returns the message from the API response", async () => {
    h.api.respond(
      "POST",
      "/v1/sharing-requests/:id/accept",
      validated("APIStatusMessage", { message: "Sharing request accepted" })
    );

    const result = await makeSharingRequest().accept();

    expect(result.message).toBe("Sharing request accepted");
  });

  it("request contract: POSTs /v1/sharing-requests/{requestId}/accept with empty body", async () => {
    h.api.respond(
      "POST",
      "/v1/sharing-requests/:id/accept",
      validated("APIStatusMessage", { message: "ok" })
    );

    await makeSharingRequest({ sharing_request_id: "req-xyz" }).accept();

    const calls = h.api.callsTo("POST", "/v1/sharing-requests/:id/accept");
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/v1/sharing-requests/req-xyz/accept");
    expect(calls[0].data).toEqual({});
  });

  it("edge case: falls back to a default message when the API returns no message", async () => {
    // Intentionally empty body — tests SDK's normalizeApiResponse fallback
    // against a spec-violating response (APIStatusMessage requires message).
    h.api.respond("POST", "/v1/sharing-requests/:id/accept", {});

    const result = await makeSharingRequest().accept();

    expect(result.message).toBe("Sharing request accepted");
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("POST", "/v1/sharing-requests/:id/accept", 404);

    await expect(makeSharingRequest().accept()).rejects.toThrow(
      "HTTP error! status: 404"
    );
  });

  it("failure mode: already-accepted request propagates the 409 error", async () => {
    h.api.fail("POST", "/v1/sharing-requests/:id/accept", 409);

    await expect(makeSharingRequest().accept()).rejects.toThrow(
      "HTTP error! status: 409"
    );
  });
});

// ===========================================================================
// decline() — POST /v1/sharing-requests/{requestId}/reject
// ===========================================================================
describe("ESPRMNeoSharingRequest.decline", () => {
  it("happy path: returns the message from the API response", async () => {
    h.api.respond(
      "POST",
      "/v1/sharing-requests/:id/reject",
      validated("APIStatusMessage", { message: "Sharing request declined" })
    );

    const result = await makeSharingRequest().decline();

    expect(result.message).toBe("Sharing request declined");
  });

  it("request contract: POSTs /v1/sharing-requests/{requestId}/reject with empty body", async () => {
    h.api.respond(
      "POST",
      "/v1/sharing-requests/:id/reject",
      validated("APIStatusMessage", { message: "ok" })
    );

    await makeSharingRequest({ sharing_request_id: "req-xyz" }).decline();

    const calls = h.api.callsTo("POST", "/v1/sharing-requests/:id/reject");
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/v1/sharing-requests/req-xyz/reject");
    expect(calls[0].data).toEqual({});
  });

  it("edge case: falls back to a default message when the API returns no message", async () => {
    // Intentionally empty body — tests SDK's normalizeApiResponse fallback.
    h.api.respond("POST", "/v1/sharing-requests/:id/reject", {});

    const result = await makeSharingRequest().decline();

    expect(result.message).toBe("Sharing request declined");
  });

  it("failure mode: API error propagates to the caller", async () => {
    h.api.fail("POST", "/v1/sharing-requests/:id/reject", 404);

    await expect(makeSharingRequest().decline()).rejects.toThrow(
      "HTTP error! status: 404"
    );
  });
});

// ===========================================================================
// Constructor mapping
// ===========================================================================
describe("ESPRMNeoSharingRequest constructor", () => {
  it("maps snake_case API fields to camelCase properties", () => {
    const req = makeSharingRequest({
      sharing_request_id: "req-999",
      group_id: "grp-test",
      subgroup_id: "sub-test",
      access_type: "primary",
      primary_user_id: "uid-1",
      primary_email: "a@b.com",
      primary_phone_number: "+1234567890",
    });

    expect(req.sharingRequestId).toBe("req-999");
    expect(req.groupId).toBe("grp-test");
    expect(req.subgroupId).toBe("sub-test");
    expect(req.accessType).toBe("primary");
    expect(req.primaryUserId).toBe("uid-1");
    expect(req.primaryEmail).toBe("a@b.com");
    expect(req.primaryPhoneNumber).toBe("+1234567890");
  });

  it("defaults optional fields to empty strings when absent", () => {
    const req = makeSharingRequest({
      primary_user_id: undefined,
      primary_email: undefined,
      primary_phone_number: undefined,
    });

    expect(req.primaryUserId).toBe("");
    expect(req.primaryEmail).toBe("");
    expect(req.primaryPhoneNumber).toBe("");
  });
});
