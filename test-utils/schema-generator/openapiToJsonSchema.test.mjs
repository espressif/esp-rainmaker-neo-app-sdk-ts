/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for the OpenAPI→JSON-Schema converter — the tool that
 * guards everything previously had zero tests of its own.
 *
 * Runs on Node's built-in test runner (the generator is native ESM, which
 * Jest's CJS transform pipeline doesn't ingest cleanly):
 *
 *   npm run schema:selftest
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { openapiToJsonSchema } from "./openapiToJsonSchema.mjs";

test("passes plain JSON Schema through untouched", () => {
  const schema = {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
  };
  assert.deepEqual(openapiToJsonSchema(schema), schema);
});

test("drops documentation-only keywords", () => {
  assert.deepEqual(
    openapiToJsonSchema({
      type: "string",
      example: "abc",
      deprecated: true,
      externalDocs: { url: "http://x" },
      xml: { name: "y" },
    }),
    { type: "string" }
  );
});

test("drops direction annotations (readOnly/writeOnly) — one bundle serves both directions", () => {
  assert.deepEqual(
    openapiToJsonSchema({
      type: "object",
      properties: {
        id: { type: "string", readOnly: true },
        secret: { type: "string", writeOnly: true },
      },
    }),
    {
      type: "object",
      properties: { id: { type: "string" }, secret: { type: "string" } },
    }
  );
});

test("maps nullable: true onto the declared type", () => {
  assert.deepEqual(openapiToJsonSchema({ type: "string", nullable: true }), {
    type: ["string", "null"],
  });
});

test("does not duplicate null in an already-null-bearing type array", () => {
  assert.deepEqual(
    openapiToJsonSchema({ type: ["string", "null"], nullable: true }),
    { type: ["string", "null"] }
  );
});

test("wraps a TYPE-LESS nullable schema in anyOf (the old blind spot)", () => {
  // nullable on an allOf composition / dereferenced $ref has no `type` to
  // extend — it used to be silently dropped.
  assert.deepEqual(
    openapiToJsonSchema({
      allOf: [{ type: "object", properties: { a: { type: "string" } } }],
      nullable: true,
    }),
    {
      anyOf: [
        { allOf: [{ type: "object", properties: { a: { type: "string" } } }] },
        { type: "null" },
      ],
    }
  );
});

test("recurses into properties, items, and composition branches", () => {
  assert.deepEqual(
    openapiToJsonSchema({
      type: "object",
      properties: {
        list: {
          type: "array",
          items: { type: "string", nullable: true, example: "x" },
        },
      },
      oneOf: [{ type: "object", example: {} }],
    }),
    {
      type: "object",
      properties: {
        list: { type: "array", items: { type: ["string", "null"] } },
      },
      oneOf: [{ type: "object" }],
    }
  );
});

test("leaves primitives and arrays of schemas intact", () => {
  assert.equal(openapiToJsonSchema(null), null);
  assert.deepEqual(openapiToJsonSchema([{ type: "string" }]), [
    { type: "string" },
  ]);
});
