/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vendors the backend API specs into `contracts/openapi/` so the SDK test
 * suite has a version-controlled snapshot of the contract it is built against.
 *
 * Specs are fetched from the deployed public URLs by default (see
 * `scripts/lib/spec-source.mjs`); a local folder can
 * be used instead via $OPENAPI_SOURCE_DIR. The vendored copies are committed
 * and never hand-edited — the deployed URLs are mutable, so the committed
 * snapshot is what pins the contract.
 *
 * Vendored set: 2 OpenAPI specs (REST) + 3 AsyncAPI specs (MQTT/push).
 * Only the OpenAPI specs feed the schema bundle today; the AsyncAPI specs are
 * vendored + checksummed so their drift is at least visible (ingestion into
 * the schema bundle is future work).
 *
 * ── Two-level drift detection ─────────────────────────────────────────────
 *
 * This script (file-level check):
 *   Answers "Is the vendored copy stale relative to the deployed spec?"
 *   Compares vendored bytes against the source — exits 1 if they differ.
 *   Run: npm run openapi:sync:check
 *
 * check-contract-drift.mjs (operation-level check):
 *   Answers "Did any backend contract the SDK actually depends on change?"
 *   Only fires for the operations/schemas in config.mjs (the allow-list).
 *   Run: npm run contracts:drift-check
 *
 * ── Manifest ownership ────────────────────────────────────────────────────
 *
 * This script owns `generatedAt` / `source` / `specs` in manifest.json and
 * MERGES around everything else. The fingerprint sections are owned by
 * `schema:gen` (test-utils/schema-generator/generate.mjs). Historically this
 * script rewrote the whole file and silently erased the fingerprints.
 *
 * Usage:
 *   node scripts/sync-openapi.mjs           # vendor specs + update manifest
 *   node scripts/sync-openapi.mjs --check   # exit 1 if vendored copy is stale
 *
 * Exit codes: 0 in sync / synced · 1 vendored copy stale · 2 source unreachable
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SPEC_FILES,
  defaultSource,
  describeSource,
  fetchSpec,
  resolveSpecSource,
} from "./lib/spec-source.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = resolve(__dirname, "..");
const VENDOR_DIR = join(SDK_ROOT, "contracts", "openapi");
const MANIFEST_PATH = join(VENDOR_DIR, "manifest.json");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * Fetch every spec from the source.
 * @returns {Promise<Array<{file: string, format: string, buf: Buffer, hash: string}>>}
 */
async function fetchAllSpecs(source) {
  return Promise.all(
    SPEC_FILES.map(async ({ file, format }) => {
      const buf = await fetchSpec(source, file);
      return { file, format, buf, hash: sha256(buf) };
    })
  );
}

/**
 * `--check` mode: compare fetched hashes against the vendored copies.
 * @returns {boolean} true when every vendored spec matches the source
 */
function checkVendoredCopies(specs) {
  let clean = true;
  for (const { file, hash } of specs) {
    const vendoredPath = join(VENDOR_DIR, file);
    const vendoredHash = existsSync(vendoredPath)
      ? sha256(readFileSync(vendoredPath))
      : null;
    if (vendoredHash !== hash) {
      clean = false;
      console.error(
        `[sync-openapi] DRIFT: ${file} differs from source. Run "npm run openapi:sync".`
      );
    }
  }
  return clean;
}

/** Write the fetched specs into contracts/openapi/. */
function vendorSpecs(specs) {
  mkdirSync(VENDOR_DIR, { recursive: true });
  for (const { file, buf } of specs) {
    writeFileSync(join(VENDOR_DIR, file), buf);
    console.log(`[sync-openapi] vendored ${file} (${buf.length} bytes)`);
  }
}

/**
 * Update the sync-owned fields of manifest.json, preserving every other key
 * (notably the fingerprint sections owned by `schema:gen`).
 */
function updateManifest(source, specs) {
  const existing = existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
    : {};

  const manifest = {
    ...existing,
    generatedAt: new Date().toISOString(),
    source: describeSource(source),
    specs: Object.fromEntries(
      specs.map(({ file, format, buf, hash }) => [
        file,
        { sha256: hash, bytes: buf.length, format },
      ])
    ),
  };

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`[sync-openapi] wrote manifest ${MANIFEST_PATH}`);
}

async function main() {
  const isCheck = process.argv.includes("--check");
  const source = resolveSpecSource();
  console.log(`[sync-openapi] source: ${describeSource(source)}`);

  const specs = await fetchAllSpecs(source);

  if (isCheck) {
    if (!checkVendoredCopies(specs)) process.exit(1);
    console.log("[sync-openapi] vendored specs are up to date.");
    return;
  }

  vendorSpecs(specs);
  updateManifest(source, specs);

  // Guardrail: a sync from a local override or
  // alternative URL is fine for demos and backend development, but the result
  // must never be committed — the committed baseline always comes from the
  // deployed URLs. The manifest records the source, and drift-check refuses
  // to run against a manifest whose source is not the deployed default.
  if (source.isOverride) {
    console.warn(
      "\n[sync-openapi] ⚠️  NON-DEFAULT SOURCE — DO NOT COMMIT THIS RESULT." +
        `\n  Vendored from: ${describeSource(source)}` +
        `\n  Committed baselines must come from: ${describeSource(defaultSource())}` +
        "\n  When you are done, restore with: git checkout -- contracts/ && npm run contracts:build"
    );
  }
}

main().catch((err) => {
  // Unreachable source, missing file, bad override — always a hard failure.
  // A sync/check that silently passes when it cannot read the spec would
  // defeat the whole point of drift detection.
  console.error(`[sync-openapi] ${err.message}`);
  process.exit(2);
});
