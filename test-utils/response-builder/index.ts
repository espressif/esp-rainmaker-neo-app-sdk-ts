/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Response builder for unit tests.
 *
 * # The model
 *
 * The developer writes the exact test fixture their scenario needs.
 * `validated()` asserts it conforms to the OpenAPI schema before the mock
 * ever returns it.  The spec provides the *shape contract*; the developer
 * provides the *values*.
 *
 * # TypeScript enforcement
 *
 * Mock stubs typed with `jest.fn<Promise<MockResponse>, [...]>()` make it a
 * **compile error** to call `mockResolvedValue()` with a raw object literal.
 * The developer must go through `validated()`.
 *
 *   import { validated, type ValidatedAny } from "../../test-utils/response-builder";
 *
 *   const mockApi = {
 *     get:  jest.fn<Promise<MockResponse>, [string]>(),
 *     post: jest.fn<Promise<MockResponse>, [string, unknown?]>(),
 *     // ...
 *   };
 *
 *   // ✅  compiles — data is validated against the schema
 *   mockApi.get.mockResolvedValue(
 *     validated("ListGroupsResponse", { groups: [...] })
 *   );
 *
 *   // ❌  TypeScript error — raw object is not Validated
 *   mockApi.get.mockResolvedValue({ groups: [...] });
 *
 * # Intentionally-invalid responses (failure-mode tests)
 *
 * Tests that deliberately pass a malformed response to exercise the SDK's
 * own guards must use the two-step bypass cast:
 *
 *   mockApi.post.mockResolvedValue({ access_key: "a" } as unknown as InvalidResponse);
 *
 * The double cast (`as unknown` first) is required because TypeScript will not
 * allow a direct cast from a plain object to a branded type — which is exactly
 * the enforcement working as designed. The `as unknown` step tells TypeScript
 * "I know what I'm doing"; `as InvalidResponse` documents the intent.
 *
 * The `InvalidResponse` alias exists so the intent is clear at the call site
 * and is grep-able in code review.
 */

import { assertValidSchema, type SchemaName } from "../schema-validator";

// ---------------------------------------------------------------------------
// Branded type
// ---------------------------------------------------------------------------

declare const __validated: unique symbol;

/**
 * A value that has been validated against a named OpenAPI schema.
 * Only `validated()` can produce this type — raw object literals are not
 * assignable to it, which is the TypeScript enforcement mechanism.
 */
export type Validated<T> = T & { readonly [__validated]: true };

/**
 * Convenience alias for the widest Validated shape.
 */
export type ValidatedAny = Validated<Record<string, unknown>>;

declare const __invalid: unique symbol;

/**
 * A payload that DELIBERATELY bypasses validation to simulate a malformed
 * backend response in failure-mode tests (a real branded type, not
 * an alias — an InvalidResponse is not assignable where Validated data is
 * required, and vice versa).
 *
 *   mockApi.post.mockResolvedValue({ access_key: "a" } as unknown as InvalidResponse);
 */
export type InvalidResponse = Record<string, unknown> & {
  readonly [__invalid]: true;
};

/**
 * What a typed mock stub may resolve with: spec-validated data, or an
 * explicitly-labelled invalid payload. Use as the return type of mocks:
 *
 *   jest.fn<Promise<MockResponse>, [string]>()
 */
export type MockResponse = ValidatedAny | InvalidResponse;

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Validate developer-written test data against a named OpenAPI schema and
 * return it as a `Validated<T>` branded value.
 *
 * Throws (failing the test) if the data violates the schema, so the suite
 * cannot run with data the backend would never actually return.
 *
 * @example
 * mockSigV4.get.mockResolvedValue(
 *   validated("ListGroupsResponse", {
 *     groups: [{ group_id: "grp-1", group_name: "Home", access_type: "primary" }],
 *   })
 * );
 */
export function validated<T extends Record<string, unknown>>(
  schema: SchemaName,
  data: T
): Validated<T> {
  assertValidSchema(schema, data);
  return data as Validated<T>;
}

/**
 * Validate an ERROR-response payload against the spec's error shapes.
 *
 * Mechanically identical to `validated()` — the separate name marks intent
 * at the call site and keeps error-path fixtures honest: before this, every
 * error-path test bypassed validation via `as unknown as InvalidResponse`,
 * so the SDK's error handling was tested against payloads nobody verified.
 *
 * Error schema names: "ApiError" (main API), "UserApiError" (auth API),
 * "APIStatusMessage" (status envelopes).
 *
 * @example
 * mockSigV4.post.mockRejectedValue(
 *   new MockHttpError(400, "Bad Request",
 *     validatedError("ApiError", { message: "Invalid request ID" }))
 * );
 */
export function validatedError<T extends Record<string, unknown>>(
  schema: SchemaName,
  data: T
): Validated<T> {
  assertValidSchema(schema, data);
  return data as Validated<T>;
}
