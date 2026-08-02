/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts an (already de-referenced) OpenAPI 3.0 Schema Object into a schema
 * AJV can validate. OpenAPI 3.0 is *almost* JSON Schema but differs in a few
 * ways — most importantly `nullable: true` instead of `type: [..., "null"]`.
 *
 * This is intentionally small: we only normalise what the RMNG specs actually
 * use. Extend as new keywords appear.
 */

const DROP_KEYS = new Set([
  "example",
  "examples",
  "externalDocs",
  "xml",
  "discriminator",
  "deprecated",
  // Direction annotations. The bundle validates BOTH requests and
  // responses with the same schemas, so a keyword that only means something
  // in one direction must not constrain the other. Dropped deliberately —
  // if per-direction enforcement is ever wanted, generate request/response
  // schema variants instead.
  "readOnly",
  "writeOnly",
]);

export function openapiToJsonSchema(schema) {
  if (Array.isArray(schema)) return schema.map(openapiToJsonSchema);
  if (schema === null || typeof schema !== "object") return schema;

  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (DROP_KEYS.has(key)) continue;

    if (key === "nullable") continue; // handled below

    if (
      key === "properties" ||
      key === "patternProperties" ||
      key === "definitions"
    ) {
      out[key] = Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, openapiToJsonSchema(v)])
      );
    } else if (
      key === "items" ||
      key === "additionalProperties" ||
      key === "not"
    ) {
      out[key] =
        typeof value === "object" ? openapiToJsonSchema(value) : value;
    } else if (key === "allOf" || key === "anyOf" || key === "oneOf") {
      out[key] = value.map(openapiToJsonSchema);
    } else {
      out[key] = openapiToJsonSchema(value);
    }
  }

  // nullable: true => permit null alongside the declared type.
  if (schema.nullable === true) {
    if (out.type) {
      out.type = Array.isArray(out.type)
        ? [...new Set([...out.type, "null"])]
        : [out.type, "null"];
    } else {
      // Nullable on a type-less schema (allOf composition, or a bare
      // dereferenced $ref) was previously DROPPED — fields the spec allows
      // to be null could never be null in tests. Wrap instead.
      return { anyOf: [out, { type: "null" }] };
    }
  }

  return out;
}
