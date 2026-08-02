/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildCanonicalQueryString } from "../../src/utils/awsSigv4Utils";

/**
 * SigV4 requires the canonical query string to be sorted by encoded parameter
 * name (then value) and strictly RFC 3986-encoded. API Gateway canonicalizes
 * the incoming query the same way before verifying, so signing the raw query
 * string breaks any request whose params are not already in sorted order —
 * the time-series endpoints (`key=...&data_type=...`) were the first caller
 * to hit this.
 */
describe("buildCanonicalQueryString", () => {
  it("sorts parameters by name (time-series query shape)", () => {
    const params = new URL(
      "https://api.example.com/v1/x?key=Light.Power&data_type=float&window=monthly&start_date=2026-01-01&end_date=2026-07-31"
    ).searchParams;
    expect(buildCanonicalQueryString(params)).toBe(
      "data_type=float&end_date=2026-07-31&key=Light.Power&start_date=2026-01-01&window=monthly"
    );
  });

  it("URI-encodes names and values per RFC 3986 (space, !'()* )", () => {
    const params = new URLSearchParams();
    params.set("key", "Temp Sensor.Temperature");
    params.set("note", "a!b'c(d)e*f");
    expect(buildCanonicalQueryString(params)).toBe(
      "key=Temp%20Sensor.Temperature&note=a%21b%27c%28d%29e%2Af"
    );
  });

  it("sorts duplicate names by value", () => {
    const params = new URLSearchParams("k=b&k=a&a=1");
    expect(buildCanonicalQueryString(params)).toBe("a=1&k=a&k=b");
  });

  it("returns an empty string for no parameters", () => {
    expect(buildCanonicalQueryString(new URLSearchParams())).toBe("");
  });

  it("sorts by code-point order, not locale order", () => {
    // "Z" (0x5A) sorts before "a" (0x61) in code-point order.
    const params = new URLSearchParams("a=1&Z=2");
    expect(buildCanonicalQueryString(params)).toBe("Z=2&a=1");
  });
});
