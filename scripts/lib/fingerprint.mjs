/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Stable contract fingerprinting — the single copy of the math.
 *
 * Used by both the schema generator (writes fingerprints into
 * contracts/openapi/manifest.json) and the drift checker (recomputes them
 * from the live spec and compares). Baseline and comparison MUST use the
 * same math, which is why it lives here and nowhere else.
 *
 * A fingerprint is a sha256 over a semantically-normalised view of a schema
 * or operation: object keys sorted, documentation-only fields stripped, so
 * that prose edits don't ring the drift alarm but shape changes do.
 */

import { createHash } from "node:crypto";

/** OpenAPI keywords that carry documentation, not contract shape. */
const NON_SEMANTIC = new Set([
  "description",
  "title",
  "example",
  "examples",
  "externalDocs",
  "xml",
  "discriminator",
  "deprecated",
  "summary",
]);

export function stableSchema(value) {
  if (Array.isArray(value)) return value.map(stableSchema);
  if (value === null || typeof value !== "object") return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (NON_SEMANTIC.has(key)) continue;
    out[key] = stableSchema(value[key]);
  }
  return out;
}

export function sha256str(str) {
  return createHash("sha256").update(str).digest("hex");
}

export function fingerprintSchema(schema) {
  return sha256str(JSON.stringify(stableSchema(schema)));
}

/**
 * Fingerprint the contract surface of one tracked operation
 * (config.mjs `operations` entry): request body schema (if tracked),
 * response schemas for the tracked statuses, and path/query parameters.
 * Returns null when the operation is absent from the spec.
 */
export function fingerprintOperation(dereferencedSpec, op) {
  const operation = dereferencedSpec.paths?.[op.path]?.[op.method];
  if (!operation) return null;

  const surface = {};

  if (op.requestBody) {
    const schema = operation.requestBody?.content?.["application/json"]?.schema;
    if (schema) surface.requestBodySchema = stableSchema(schema);
  }

  surface.responses = {};
  for (const status of op.statuses ?? []) {
    const schema = operation.responses?.[status]?.content?.["application/json"]?.schema;
    if (schema) surface.responses[status] = stableSchema(schema);
  }

  const params = (operation.parameters ?? []).filter(
    (p) => p.in === "path" || p.in === "query"
  );
  if (params.length > 0) {
    surface.parameters = params
      .map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required ?? false,
        schema: p.schema ? stableSchema(p.schema) : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return sha256str(JSON.stringify(surface));
}
