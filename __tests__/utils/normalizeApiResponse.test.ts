/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { normalizeApiResponse } from "../../src/utils/normalizeApiResponse";

describe("normalizeApiResponse", () => {
  it("returns fallback for nullish responses", () => {
    expect(normalizeApiResponse(undefined)).toEqual({});
    expect(normalizeApiResponse(null)).toEqual({});
  });

  it("passes through message when present", () => {
    expect(
      normalizeApiResponse({ message: "Sharing request accepted" })
    ).toEqual({ message: "Sharing request accepted" });
  });

  it("returns fallback for empty or unrecognized payloads", () => {
    expect(normalizeApiResponse({})).toEqual({});
    expect(normalizeApiResponse({ status: "success" })).toEqual({});
    expect(
      normalizeApiResponse({ status: "success", description: "done" })
    ).toEqual({});
  });
});
