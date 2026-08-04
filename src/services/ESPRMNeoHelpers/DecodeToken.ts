/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts a base64url string to standard base64 (adds padding and replaces
 * URL-safe characters). JWT segments use base64url per RFC 7519.
 */
function base64UrlToBase64(s: string): string {
  const swapped = s.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (swapped.length % 4)) % 4;
  return swapped + "=".repeat(padding);
}

/**
 * Decodes a JWT and returns the payload (middle segment) as a parsed object.
 * Uses base64url decoding per RFC 7519 and UTF-8 decoding so non-ASCII fields
 * (e.g. unicode usernames) round-trip correctly.
 *
 * @param token - The JWT to decode.
 * @returns The decoded payload object.
 * @throws Error with a clear message if the token is malformed, non-base64url,
 *   or the payload is not valid JSON.
 */
const decodeToken = (token: string): Record<string, unknown> => {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("decodeToken: token must be a non-empty string");
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error(
      "decodeToken: token is not a valid JWT (expected three '.'-separated segments)"
    );
  }
  try {
    const base64 = base64UrlToBase64(parts[1]);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`decodeToken: failed to decode payload — ${detail}`);
  }
};

export { decodeToken };
