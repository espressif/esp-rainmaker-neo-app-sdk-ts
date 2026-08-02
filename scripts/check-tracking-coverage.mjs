/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tracking-coverage check.
 *
 * The drift detector only protects what `config.mjs` tracks. That
 * list is hand-maintained, so its historical failure mode is silent: add an
 * SDK method, forget to register its endpoint, and that endpoint gets no
 * drift detection and no warning — forever.
 *
 * This script makes the gap loud. It extracts every path the SDK can call
 * (the `APIPathV1` map in src/utils/constants.ts — string constants and
 * template-literal path builders) and compares it against:
 *
 *   - the tracked operations in config.mjs (`specs[].operations`), and
 *   - the conscious-ignore ledger in config.mjs (`untrackedPaths`) — paths
 *     we have LOOKED AT and decided not to track, each with a reason.
 *
 * Any SDK path in neither list fails the check (exit 1). A stale ignore
 * entry (path no longer in the SDK, or now tracked) also fails — the ledger
 * must describe reality. Tracked-but-unreferenced operations are a warning
 * only (request bodies/verbs can make them legitimate).
 *
 * Paths are compared structurally: `{groupId}`-style placeholders on both
 * sides are normalised to `{}` so parameter *names* never cause mismatches.
 *
 * Exit codes: 0 covered · 1 gap or stale ignore · 2 cannot parse inputs
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { specs, untrackedPaths } from "../test-utils/schema-generator/config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = resolve(__dirname, "..");
const CONSTANTS_PATH = join(SDK_ROOT, "src", "utils", "constants.ts");

// ---------------------------------------------------------------------------
// 1. Extract every path template from APIPathV1
// ---------------------------------------------------------------------------

/** `/v1/groups/${groupId}/nodes/${x}` → `/v1/groups/{}/nodes/{}` */
function normalize(pathTemplate) {
  return pathTemplate
    .replace(/\$\{[^}]*\}/g, "{}") // template interpolations
    .replace(/\{[^}]*\}/g, "{}"); // spec-style {param} placeholders
}

function extractSdkPaths(source) {
  const block = source.match(/const APIPathV1 = \{([\s\S]*?)\n\} as const;/);
  if (!block) {
    console.error(
      "[coverage-check] could not locate `const APIPathV1 = {...} as const;` " +
        "in src/utils/constants.ts — update the extractor if the map moved."
    );
    process.exit(2);
  }

  const paths = new Map(); // normalized -> { raw, key }
  // String constants:  KEY: "/v1/...",   and template builders: `...${x}...`
  const entryRe = /(\w+):(?:[^"`]*?)(?:"([^"]+)"|`([^`]+)`)/g;
  for (const m of block[1].matchAll(entryRe)) {
    const [, key, str, tpl] = m;
    const raw = str ?? tpl;
    if (!raw || !raw.startsWith("/")) continue; // not a path
    paths.set(normalize(raw), { raw: raw.replace(/\$\{[^}]*?(\w+)\)?\}/g, "{$1}"), key });
  }
  return paths;
}

// ---------------------------------------------------------------------------
// 2. Collect tracked + consciously-untracked paths from config.mjs
// ---------------------------------------------------------------------------

const tracked = new Map(); // normalized -> spec path
for (const spec of specs) {
  for (const op of spec.operations ?? []) {
    tracked.set(normalize(op.path), op.path);
  }
}

const ignored = new Map(); // normalized -> { path, reason }
for (const entry of untrackedPaths ?? []) {
  ignored.set(normalize(entry.path), entry);
}

// ---------------------------------------------------------------------------
// 3. Compare
// ---------------------------------------------------------------------------

const sdkPaths = extractSdkPaths(readFileSync(CONSTANTS_PATH, "utf8"));

const gaps = [];
for (const [norm, info] of sdkPaths) {
  if (tracked.has(norm)) continue;
  if (ignored.has(norm)) continue;
  gaps.push(info);
}

const staleIgnores = [];
for (const [norm, entry] of ignored) {
  if (!sdkPaths.has(norm)) {
    staleIgnores.push({ ...entry, why: "path no longer appears in APIPathV1" });
  } else if (tracked.has(norm)) {
    staleIgnores.push({ ...entry, why: "path is now tracked — remove the ignore" });
  }
}

const unreferenced = [];
for (const [norm, specPath] of tracked) {
  if (!sdkPaths.has(norm)) unreferenced.push(specPath);
}

// ---------------------------------------------------------------------------
// 4. Report
// ---------------------------------------------------------------------------

console.log(
  `[coverage-check] APIPathV1 paths: ${sdkPaths.size} · tracked: ${tracked.size} · consciously untracked: ${ignored.size}`
);

if (unreferenced.length > 0) {
  console.warn("\n  ⚠ tracked in config.mjs but not found in APIPathV1 (stale entry?):");
  for (const p of unreferenced) console.warn(`      ${p}`);
}

if (staleIgnores.length > 0) {
  console.error("\n  ✗ stale entries in untrackedPaths (the ledger must match reality):");
  for (const e of staleIgnores) console.error(`      ${e.path} — ${e.why}`);
}

if (gaps.length > 0) {
  console.error("\n  ✗ SDK paths with NO drift protection and NO conscious-ignore entry:");
  for (const g of gaps) console.error(`      ${g.raw}   (APIPathV1.${g.key})`);
  console.error(
    "\n  Fix: add the operation to config.mjs `operations` (preferred), or add a\n" +
      "  reasoned entry to config.mjs `untrackedPaths` if not tracking is deliberate."
  );
}

if (gaps.length > 0 || staleIgnores.length > 0) process.exit(1);
console.log("✓ Every SDK path is either drift-tracked or consciously untracked.");
