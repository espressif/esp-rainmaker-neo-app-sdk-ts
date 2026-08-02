/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Contract layer — schema bundle integrity.
 *
 * Validates that `contracts/openapi/generated/schemas.json` is well-formed
 * and all exported schemas compile correctly with AJV.
 *
 * This is the network-free half of contract testing. It catches:
 *   - A corrupt or hand-edited schemas.json
 *   - A schema that fails AJV compilation (invalid JSON Schema syntax after
 *     OpenAPI normalisation)
 *   - A missing schema (added to config.mjs but schema:gen not re-run)
 *
 * The live-backend half (validate real API responses against the same bundle)
 * lives in README.md alongside this file — enable it in nightly CI when
 * backend credentials are available.
 */

import {
  type SchemaName,
  availableSchemas,
  validateAgainstSchema,
} from "../../test-utils/schema-validator";

describe("Contract: OpenAPI schema bundle", () => {
  const schemas = availableSchemas();

  it("bundle is present and non-empty", () => {
    expect(schemas.length).toBeGreaterThan(0);
  });

  it.each(schemas.map((s) => [s] as const))(
    "schema '%s' compiles with AJV and returns a valid result object",
    (schemaName) => {
      // AJV registers all schemas at import time (schema-validator/index.ts).
      // If a schema is malformed the import itself would throw — this test
      // documents that expectation and provides a per-schema failure report.
      // Passing {} exercises the validator for schemas that have required fields
      // (expected: valid=false, but no throw — the schema compiled successfully).
      const result = validateAgainstSchema(schemaName as SchemaName, {});
      expect(typeof result.valid).toBe("boolean");
      expect(Array.isArray(result.errors)).toBe(true);
    }
  );

  // Compiling is not enough — an accidentally-empty schema ({}), or one
  // whose constraints were stripped by a converter bug, compiles fine and
  // accepts everything. Every schema must also REJECT an obviously-wrong
  // payload: a value of a different JSON type than the schema declares.
  const WRONG_BY_TYPE: Record<string, unknown> = {
    object: 42,
    array: { not: "an array" },
    string: 42,
    number: "not-a-number",
    integer: "not-an-integer",
    boolean: "not-a-boolean",
  };

  it.each(schemas.map((s) => [s] as const))(
    "schema '%s' rejects an obviously type-mismatched payload",
    (schemaName) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bundle = require("../../contracts/openapi/generated/schemas.json");
      const schema = bundle.schemas[schemaName as string] as {
        type?: string | string[];
      };
      const declared = Array.isArray(schema.type) ? schema.type[0] : schema.type;
      if (!declared || !(declared in WRONG_BY_TYPE)) {
        // No top-level type to violate (e.g. pure oneOf) — the per-example
        // and closed-world tests cover these; nothing generic to assert.
        return;
      }
      const result = validateAgainstSchema(
        schemaName as SchemaName,
        WRONG_BY_TYPE[declared]
      );
      expect(result.valid).toBe(false);
    }
  );

  it("nearly every schema declares a top-level type (guards the test above)", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bundle = require("../../contracts/openapi/generated/schemas.json");
    const untyped = schemas.filter(
      (n) => !(bundle.schemas[n as string] as { type?: unknown }).type
    );
    // If this grows, the reject-test above is silently skipping schemas —
    // look at what changed in the spec/generator.
    expect(untyped.length).toBeLessThanOrEqual(2);
  });
});
