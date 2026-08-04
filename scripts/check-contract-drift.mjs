/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Operation-level contract drift detector.
 *
 * Compares the live backend OpenAPI spec against the fingerprints stored in
 * `contracts/openapi/manifest.json` (written by `npm run schema:gen`).
 *
 * ONLY flags changes to operations and component schemas that the SDK
 * actually wraps — i.e., the entries in `test-utils/schema-generator/config.mjs`.
 * Endpoints the SDK does not wrap are ignored completely.
 *
 * This is deliberately different from `openapi:sync:check` (which detects
 * whether the vendored YAML byte-copy is stale). That check answers:
 *   "Is the vendored snapshot stale relative to the deployed spec?"
 * This check answers:
 *   "Did any backend contract the SDK depends on change since last generation?"
 *
 * The live spec is read via `scripts/lib/spec-source.mjs` — the deployed
 * public URLs by default, $OPENAPI_SOURCE_DIR as a local override. An
 * unreachable source is a hard failure (exit 2), never a silent pass.
 *
 * Exit codes
 *   0 — all tracked operations and schemas are unchanged
 *   1 — at least one tracked operation or schema changed (re-run contracts:build)
 *   2 — configuration problem (source unreachable, manifest not found, etc.)
 *
 * Usage
 *   node scripts/check-contract-drift.mjs
 *   node scripts/check-contract-drift.mjs --verbose   # print unchanged too
 */

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import SwaggerParser from "@apidevtools/swagger-parser";

import { specs as trackedSpecs } from "../test-utils/schema-generator/config.mjs";
import { asyncapiSurface, loadAsyncapi } from "./lib/asyncapi.mjs";
import { fingerprintOperation, fingerprintSchema } from "./lib/fingerprint.mjs";
import {
  defaultSource,
  describeSource,
  fetchSpec,
  isOverrideActive,
  resolveSpecSource,
} from "./lib/spec-source.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = resolve(__dirname, "..");
const VENDOR_DIR = join(SDK_ROOT, "contracts", "openapi");
const MANIFEST_PATH = join(VENDOR_DIR, "manifest.json");

const verbose = process.argv.includes("--verbose");


/** exportedSchemas entries are either "Name" or { name, as } (alias). */
function normalizeExport(entry) {
  return typeof entry === "string" ? { name: entry, as: entry } : entry;
}

// ---------------------------------------------------------------------------
// Live spec loading
// ---------------------------------------------------------------------------

/**
 * Fetch one live spec (via the shared source resolver) into a temp file and
 * return its path. SwaggerParser.dereference() wants a file path, and going
 * through a temp file keeps this working identically for URL and local-dir
 * sources.
 */
async function fetchSpecToTempFile(source, tempDir, fileName) {
  const buf = await fetchSpec(source, fileName);
  const path = join(tempDir, fileName);
  writeFileSync(path, buf);
  return path;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Load committed fingerprints.
  if (!existsSync(MANIFEST_PATH)) {
    console.error(
      "[drift-check] manifest.json not found. Run `npm run schema:gen` first."
    );
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  if (!manifest.operationFingerprints) {
    console.error(
      "[drift-check] manifest.json has no operationFingerprints. " +
        "Run `npm run schema:gen` to populate it."
    );
    process.exit(2);
  }

  // Guardrail: refuse to compare against a
  // baseline that wasn't generated from the committed default source
  // (contracts/openapi/spec-source.json). A manifest synced from a local
  // override (demo runs, backend development) is not the committed contract —
  // comparing against it would make drift results meaningless. Overrides are
  // still usable for the CURRENT run via $OPENAPI_SOURCE_DIR /
  // $OPENAPI_SOURCE_URL / spec-source.local.json, which skips this check.
  const defaultSourceName = describeSource(defaultSource());
  if (
    !isOverrideActive() &&
    manifest.source &&
    manifest.source !== defaultSourceName
  ) {
    console.error(
      "[drift-check] manifest.json was generated from a non-default source:" +
        `\n    ${manifest.source}` +
        `\n  The committed baseline must come from: ${defaultSourceName}` +
        "\n  Restore it with: git checkout -- contracts/ && npm run contracts:build"
    );
    process.exit(2);
  }

  // 2. Resolve the live spec source (deployed URLs by default). Any failure
  //    to reach it is fatal — the catch at the bottom exits 2.
  const source = resolveSpecSource();
  const tempDir = mkdtempSync(join(tmpdir(), "rmneo-drift-check-"));

  console.log(`[drift-check] source: ${describeSource(source)}`);
  if (manifest.fingerprintsGeneratedAt) {
    console.log(`[drift-check] fingerprints last generated: ${manifest.fingerprintsGeneratedAt}`);
  }
  console.log("");

  let totalChecked = 0;
  let totalChanged = 0;
  let totalAdded = 0;    // operation in config.mjs but not in committed manifest yet
  let totalMissing = 0;  // operation in config.mjs but missing from the live source spec

  // 3. For each tracked spec, fetch the SOURCE and recompute fingerprints.
  for (const specCfg of trackedSpecs) {
    const srcPath = await fetchSpecToTempFile(source, tempDir, specCfg.specFile);

    console.log(`=== ${specCfg.specFile} ===`);

    const committedOpFps = manifest.operationFingerprints?.[specCfg.specFile] ?? {};
    const committedSchFps = manifest.schemaFingerprints?.[specCfg.specFile] ?? {};

    /** Compare one live fingerprint against the committed baseline. */
    const compare = (key, liveFp, committed, label = key) => {
      totalChecked++;
      const committedFp = committed[key];
      if (!committedFp) {
        console.log(`  +  NEW (not baselined): ${label}`);
        totalAdded++;
      } else if (liveFp !== committedFp) {
        console.log(`  ✗  CHANGED: ${label}`);
        totalChanged++;
      } else if (verbose) {
        console.log(`  ✓  unchanged: ${label}`);
      }
    };

    // -- AsyncAPI branch (MQTT/push) -----------------------------------------
    if (specCfg.format === "asyncapi") {
      const doc = loadAsyncapi(readFileSync(srcPath, "utf8"));

      for (const name of specCfg.messages ?? []) {
        const payload = doc.components?.messages?.[name]?.payload;
        if (!payload) {
          console.warn(`  ⚠  MISSING message in source: ${name}`);
          totalMissing++;
          continue;
        }
        compare(`MESSAGE ${name}`, fingerprintSchema(payload), committedOpFps);
      }

      // Channels: every committed channel must still exist (a removed or
      // renamed topic is severe drift), and live channels are compared or
      // reported as new.
      const { channels } = asyncapiSurface(doc, { ...specCfg, messages: [] });
      for (const key of Object.keys(committedOpFps).filter((k) => k.startsWith("CHANNEL "))) {
        if (!channels[key.slice("CHANNEL ".length)]) {
          console.warn(`  ⚠  MISSING channel in source: ${key.slice("CHANNEL ".length)}`);
          totalMissing++;
        }
      }
      for (const [name, ch] of Object.entries(channels)) {
        compare(`CHANNEL ${name}`, fingerprintSchema(ch), committedOpFps);
      }

      console.log(`  -- schemas --`);
      for (const entry of specCfg.exportedSchemas ?? []) {
        const { name, as } = normalizeExport(entry);
        const liveSchema = doc.components?.schemas?.[name];
        if (!liveSchema) {
          console.warn(`  ⚠  MISSING schema in source: ${name}`);
          totalMissing++;
          continue;
        }
        compare(as, fingerprintSchema(liveSchema), committedSchFps, `schema: ${as}`);
      }

      console.log("");
      continue;
    }

    // Dereference so shared component schemas propagate into operation shapes.
    const spec = await SwaggerParser.dereference(srcPath);

    // -- Operations --------------------------------------------------------
    for (const op of specCfg.operations ?? []) {
      const key = `${op.method.toUpperCase()} ${op.path}`;
      const liveFp = fingerprintOperation(spec, op);

      if (!liveFp) {
        console.warn(`  ⚠  MISSING in source: ${key}  (endpoint was removed from the spec?)`);
        totalMissing++;
        continue;
      }

      const committedFp = committedOpFps[key];
      totalChecked++;

      if (!committedFp) {
        // Operation is tracked in config.mjs but has no committed fingerprint yet
        // (run `npm run schema:gen` to baseline it).
        console.log(`  +  NEW (not baselined): ${key}`);
        totalAdded++;
      } else if (liveFp !== committedFp) {
        console.log(`  ✗  CHANGED: ${key}`);
        totalChanged++;
      } else {
        if (verbose) console.log(`  ✓  unchanged: ${key}`);
      }
    }

    // -- Exported component schemas ----------------------------------------
    console.log(`  -- schemas --`);
    for (const entry of specCfg.exportedSchemas ?? []) {
      const { name, as } = normalizeExport(entry);
      const liveSchema = spec.components?.schemas?.[name];
      if (!liveSchema) {
        console.warn(`  ⚠  MISSING schema in source: ${name}`);
        totalMissing++;
        continue;
      }
      compare(as, fingerprintSchema(liveSchema), committedSchFps, `schema: ${as}`);
    }

    console.log("");
  }

  // 4. Summary and exit code.
  console.log("─".repeat(60));
  console.log(`Checked ${totalChecked} operations/schemas.`);
  if (totalAdded > 0)
    console.log(`  ${totalAdded} new (not yet baselined — run npm run schema:gen)`);
  if (totalMissing > 0)
    console.log(`  ${totalMissing} missing from live spec (removed from backend?)`);

  if (totalChanged === 0 && totalAdded === 0 && totalMissing === 0) {
    console.log("✓ No contract drift detected in tracked operations.");
    process.exit(0);
  }

  if (totalChanged > 0 || totalMissing > 0) {
    // A tracked operation that DISAPPEARED from the backend is the most
    // severe drift of all — the SDK is calling an endpoint that no longer
    // exists. It must fail just like a changed one.
    console.log(
      `\n✗ ${totalChanged} changed, ${totalMissing} missing tracked operation(s)/schema(s).` +
        "\n  Run `npm run contracts:build` to regenerate the schema bundle," +
        "\n  then review the diff and update any affected SDK code." +
        "\n  For removed endpoints: update src + config.mjs, or consciously untrack them."
    );
    process.exit(1);
  }

  // Only new/unbaselined — not a hard failure, but informational.
  process.exit(0);
}

main().catch((err) => {
  console.error("[drift-check] crashed:", err);
  process.exit(2);
});
