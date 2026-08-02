/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OpenAPI schema generator.
 *
 * Reads the vendored OpenAPI specs and produces two artefacts:
 *
 *   contracts/openapi/generated/schemas.json
 *     AJV-ready named schema bundle. Every schema listed in
 *     `config.mjs → exportedSchemas` is normalised from OpenAPI 3.0 to
 *     JSON Schema and written here.  This is the runtime source of truth
 *     consumed by `validated()` in unit tests and `assertValidSchema()` in
 *     workflow tests — it is what prevents mock drift.
 *
 *   contracts/openapi/manifest.json  (fingerprints section)
 *     Per-operation and per-schema sha256 fingerprints for contract drift
 *     detection (`npm run contracts:drift-check`).
 *
 * This script does NOT write fixture JSON files. Test data is the
 * developer's responsibility; the framework's responsibility is to validate
 * that data against the schema bundle at test runtime.
 *
 * Run:
 *   npm run schema:gen
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import SwaggerParser from "@apidevtools/swagger-parser";

import { asyncapiSurface, loadAsyncapi } from "../../scripts/lib/asyncapi.mjs";
import {
  fingerprintOperation,
  fingerprintSchema,
} from "../../scripts/lib/fingerprint.mjs";
import { specs } from "./config.mjs";
import { openapiToJsonSchema } from "./openapiToJsonSchema.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_ROOT   = resolve(__dirname, "..", "..");
const OPENAPI_DIR = join(SDK_ROOT, "contracts", "openapi");
const SCHEMA_OUT  = join(OPENAPI_DIR, "generated", "schemas.json");

const GENERATED_HEADER = {
  _generated: true,
  _doNotEdit: "Run `npm run schema:gen` to regenerate. Source: contracts/openapi/.",
};


/** exportedSchemas entries are either "Name" or { name, as } (alias — needed
 * when two specs define the same component name with different shapes,
 * e.g. both REST specs define `Error`). */
function normalizeExport(entry) {
  return typeof entry === "string" ? { name: entry, as: entry } : entry;
}

// ---------------------------------------------------------------------------
// AsyncAPI ingestion
// ---------------------------------------------------------------------------

/**
 * Export an AsyncAPI spec's message payloads (as `<prefix>:<messageName>`)
 * and component schemas into the bundle, and fingerprint messages + channels
 * for drift detection. Channels are always fingerprinted — a topic address
 * rename is drift even when no payload changed.
 */
function ingestAsyncapi(specCfg, specPath, { schemaBundle, operationFingerprints, schemaFingerprints, problems }) {
  const doc = loadAsyncapi(readFileSync(specPath, "utf8"));
  const surface = asyncapiSurface(doc, specCfg);

  schemaFingerprints[specCfg.specFile] = {};
  for (const entry of specCfg.exportedSchemas ?? []) {
    const { name, as } = normalizeExport(entry);
    const schema = doc.components?.schemas?.[name];
    if (!schema) {
      problems.push(`exported schema not found in ${specCfg.specFile}: ${name}`);
      continue;
    }
    if (schemaBundle[as]) {
      problems.push(`duplicate exported schema name: ${as}`);
    }
    schemaBundle[as] = openapiToJsonSchema(schema);
    schemaFingerprints[specCfg.specFile][as] = fingerprintSchema(schema);
    console.log(`[schema-gen]   schema  ${as}${as !== name ? ` (spec: ${name})` : ""}`);
  }

  operationFingerprints[specCfg.specFile] = {};
  for (const [name, payload] of Object.entries(surface.messages)) {
    schemaBundle[`${specCfg.messagePrefix}:${name}`] = openapiToJsonSchema(payload);
    operationFingerprints[specCfg.specFile][`MESSAGE ${name}`] =
      fingerprintSchema(payload);
    console.log(`[schema-gen]   message  ${specCfg.messagePrefix}:${name}`);
  }
  for (const [name, ch] of Object.entries(surface.channels)) {
    operationFingerprints[specCfg.specFile][`CHANNEL ${name}`] =
      fingerprintSchema(ch);
    console.log(`[schema-gen]   channel  ${name} → ${ch.address ?? "(no address)"}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const schemaBundle = {};
  const operationFingerprints = {};
  const schemaFingerprints    = {};
  // A config entry that doesn't match the spec is a hard failure, not
  // a warning — a mistyped schema name would otherwise silently produce a
  // bundle with a hole in it.
  const problems = [];

  for (const specCfg of specs) {
    const specPath = join(OPENAPI_DIR, specCfg.specFile);
    console.log(`\n[schema-gen] === ${specCfg.specFile} ===`);
    if (!existsSync(specPath)) {
      console.error(`[schema-gen] spec not found. Run "npm run openapi:sync" first.`);
      process.exit(1);
    }

    // AsyncAPI specs (MQTT/push) take their own branch: js-yaml +
    // local $ref resolution instead of SwaggerParser (which only reads OpenAPI).
    if (specCfg.format === "asyncapi") {
      ingestAsyncapi(specCfg, specPath, {
        schemaBundle,
        operationFingerprints,
        schemaFingerprints,
        problems,
      });
      continue;
    }

    const spec = await SwaggerParser.dereference(specPath);
    const componentSchemas = spec.components?.schemas ?? {};

    // --- Schema bundle ---
    schemaFingerprints[specCfg.specFile] = {};
    for (const entry of specCfg.exportedSchemas ?? []) {
      const { name, as } = normalizeExport(entry);
      if (!componentSchemas[name]) {
        problems.push(`exported schema not found in ${specCfg.specFile}: ${name}`);
        continue;
      }
      if (schemaBundle[as]) {
        problems.push(`duplicate exported schema name: ${as}`);
      }
      schemaBundle[as] = openapiToJsonSchema(componentSchemas[name]);
      schemaFingerprints[specCfg.specFile][as] = fingerprintSchema(componentSchemas[name]);
      console.log(`[schema-gen]   schema  ${as}${as !== name ? ` (spec: ${name})` : ""}`);
    }

    // --- Operation fingerprints + request-body schemas ---
    operationFingerprints[specCfg.specFile] = {};
    for (const op of specCfg.operations ?? []) {
      const key = `${op.method.toUpperCase()} ${op.path}`;
      const fp  = fingerprintOperation(spec, op);
      if (fp) {
        operationFingerprints[specCfg.specFile][key] = fp;
        console.log(`[schema-gen]   fingerprint  ${key}`);
      } else {
        problems.push(`tracked operation not found in ${specCfg.specFile}: ${key}`);
      }

      // Export the request-body schema under an operation key so tests can
      // validate what the SDK *sends*, not just what it receives
      // (`expectValidRequest()` / MockApiManager auto-validation).
      if (op.requestBody) {
        const rbSchema =
          spec.paths?.[op.path]?.[op.method]?.requestBody?.content?.[
            "application/json"
          ]?.schema;
        if (rbSchema) {
          schemaBundle[`request:${key}`] = openapiToJsonSchema(rbSchema);
          console.log(`[schema-gen]   request  ${key}`);
        } else {
          problems.push(
            `requestBody: true but no JSON body schema in ${specCfg.specFile}: ${key}`
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    console.error(
      `\n[schema-gen] ✗ config.mjs and the vendored specs disagree (${problems.length}):`
    );
    for (const p of problems) console.error(`    ${p}`);
    console.error(
      "  Fix config.mjs (or re-run openapi:sync) — nothing was written."
    );
    process.exit(1);
  }

  // Write schema bundle
  mkdirSync(dirname(SCHEMA_OUT), { recursive: true });
  writeFileSync(
    SCHEMA_OUT,
    JSON.stringify({ ...GENERATED_HEADER, schemas: schemaBundle }, null, 2) + "\n"
  );
  console.log(
    `\n[schema-gen] wrote ${Object.keys(schemaBundle).length} schemas → ${SCHEMA_OUT}`
  );

  // Write fingerprints into the contracts manifest
  const MANIFEST_PATH = join(OPENAPI_DIR, "manifest.json");
  const existing = existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
    : {};
  writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        ...existing,
        operationFingerprints,
        schemaFingerprints,
        fingerprintsGeneratedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n"
  );
  console.log(`[schema-gen] wrote operation fingerprints → ${MANIFEST_PATH}`);
  console.log(`[schema-gen] done.`);
}

main().catch((err) => {
  console.error("[schema-gen] crashed:", err);
  process.exit(1);
});
