/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single source of truth for WHERE backend specs come from and HOW to read them.
 *
 * Used by `scripts/sync-openapi.mjs` (vendoring) and
 * `scripts/check-contract-drift.mjs` (live drift detection) so both always
 * agree on the source. Before this module existed, each script had its own
 * folder-search logic with different candidates — and could disagree about
 * which spec was "the truth" on the same machine.
 *
 * The DEFAULT location is no longer hardcoded here — it lives in the
 * committed config `contracts/openapi/spec-source.json` (`baseUrl` plus
 * optional per-file absolute `urls`), so pointing the framework at a new
 * deployment/region is a config edit, not a code change.
 *
 * Resolution order (first match wins):
 *   1. $OPENAPI_SOURCE_DIR   — local folder, for backend developers working
 *                              against an unpublished spec (one-off runs).
 *   2. $OPENAPI_SOURCE_URL   — alternative base URL (one-off runs).
 *   3. spec-source.local.json — personal override file (gitignored; same
 *                              shape as the committed config plus optional
 *                              `dir`), for a longer-lived staging/region setup.
 *   4. spec-source.json      — the committed default (the ONLY source whose
 *                              results may be committed).
 *
 * Any of 1–3 marks the run as an override — `isOverrideActive()` — which
 * makes sync-openapi print its DO-NOT-COMMIT warning and drift-check skip
 * the manifest-source guardrail for the current run.
 *
 * An unreachable source is always a hard error. Callers must NOT soft-pass:
 * a drift gate that silently skips when it cannot read the spec is worse
 * than no gate at all.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAPI_DIR = resolve(__dirname, "..", "..", "contracts", "openapi");

export const SPEC_SOURCE_CONFIG_PATH = join(OPENAPI_DIR, "spec-source.json");
export const SPEC_SOURCE_LOCAL_PATH = join(
  OPENAPI_DIR,
  "spec-source.local.json"
);

/**
 * Every backend spec the SDK vendors.
 * `format` tells downstream tooling which parser applies:
 *   - "openapi"  → OpenAPI 3.0  (@apidevtools/swagger-parser)
 *   - "asyncapi" → AsyncAPI 3.1 (MQTT/push payload schemas)
 */
export const SPEC_FILES = [
  { file: "Api_Swagger.yaml", format: "openapi" },
  { file: "User_Api_Swagger.yaml", format: "openapi" },
  { file: "MQTT_User.yaml", format: "asyncapi" },
  { file: "MQTT_Node.yaml", format: "asyncapi" },
  { file: "Push_User.yaml", format: "asyncapi" },
];

/**
 * Read and validate a spec-source config file.
 *
 * @param {string} path
 * @param {{ required?: boolean, allowDir?: boolean }} opts
 * @returns {{ baseUrl?: string, urls?: Record<string,string>, dir?: string } | null}
 * @throws  {Error} on a missing required file, unparseable JSON, or a shape
 *                  that would silently misconfigure the drift gates.
 */
function readConfigFile(path, { required = false, allowDir = false } = {}) {
  if (!existsSync(path)) {
    if (required) {
      throw new Error(`spec-source config not found: ${path}`);
    }
    return null;
  }
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`spec-source config is not valid JSON: ${path} (${err.message})`);
  }
  if (cfg.dir !== undefined && !allowDir) {
    throw new Error(
      `"dir" is only allowed in the local override, not in: ${path}`
    );
  }
  if (cfg.baseUrl !== undefined && typeof cfg.baseUrl !== "string") {
    throw new Error(`"baseUrl" must be a string in: ${path}`);
  }
  if (cfg.urls !== undefined) {
    const known = new Set(SPEC_FILES.map((s) => s.file));
    for (const [file, url] of Object.entries(cfg.urls)) {
      if (!known.has(file)) {
        throw new Error(
          `"urls" key "${file}" in ${path} matches no SPEC_FILES entry`
        );
      }
      if (typeof url !== "string" || url.length === 0) {
        throw new Error(`"urls.${file}" must be a non-empty URL in: ${path}`);
      }
    }
  }
  return cfg;
}

/** The committed default config (baseUrl + optional per-file urls). */
export function readCommittedConfig() {
  const cfg = readConfigFile(SPEC_SOURCE_CONFIG_PATH, { required: true });
  if (!cfg.baseUrl) {
    throw new Error(
      `"baseUrl" is required in the committed config: ${SPEC_SOURCE_CONFIG_PATH}`
    );
  }
  return cfg;
}

/**
 * The deployed default base URL — what committed baselines must come from.
 * Kept as a getter-style export so guardrail messages and checks always read
 * the CURRENT committed config, never a stale import-time snapshot.
 */
export function defaultSpecBaseUrl() {
  return readCommittedConfig().baseUrl;
}

/**
 * Pure resolution core — separated from the file/env reads so the selftest
 * can exercise the precedence rules without touching the real repo files.
 *
 * @param {{ env: Record<string, string|undefined>,
 *           localCfg: ReturnType<typeof readConfigFile>,
 *           committedCfg: { baseUrl: string, urls?: Record<string,string> } }} input
 * @returns {{ kind: "dir", dir: string, isOverride: boolean }
 *         | { kind: "url", baseUrl: string, urls: Record<string,string>, isOverride: boolean }}
 */
export function resolveSpecSourceFrom({ env, localCfg, committedCfg }) {
  if (env.OPENAPI_SOURCE_DIR) {
    return { kind: "dir", dir: env.OPENAPI_SOURCE_DIR, isOverride: true };
  }
  if (env.OPENAPI_SOURCE_URL) {
    // A one-off env URL is a FULL replacement — per-file urls from config
    // files do not leak into it.
    return {
      kind: "url",
      baseUrl: env.OPENAPI_SOURCE_URL,
      urls: {},
      isOverride: true,
    };
  }
  if (localCfg) {
    if (localCfg.dir) {
      return { kind: "dir", dir: localCfg.dir, isOverride: true };
    }
    return {
      kind: "url",
      baseUrl: localCfg.baseUrl ?? committedCfg.baseUrl,
      urls: { ...(committedCfg.urls ?? {}), ...(localCfg.urls ?? {}) },
      isOverride: true,
    };
  }
  return {
    kind: "url",
    baseUrl: committedCfg.baseUrl,
    urls: { ...(committedCfg.urls ?? {}) },
    isOverride: false,
  };
}

/**
 * The source every committed baseline must come from: the committed config
 * with no overrides applied. `describeSource(defaultSource())` is the
 * canonical string recorded in (and checked against) manifest.json.
 */
export function defaultSource() {
  return resolveSpecSourceFrom({
    env: {},
    localCfg: null,
    committedCfg: readCommittedConfig(),
  });
}

/**
 * Decide where specs are read from for this run.
 *
 * @returns {ReturnType<typeof resolveSpecSourceFrom>}
 * @throws  {Error} when an override points at a directory that does not exist
 *                  (a set-but-wrong override should fail, not fall through).
 */
export function resolveSpecSource() {
  const source = resolveSpecSourceFrom({
    env: process.env,
    localCfg: readConfigFile(SPEC_SOURCE_LOCAL_PATH, { allowDir: true }),
    committedCfg: readCommittedConfig(),
  });
  if (source.kind === "dir" && !existsSync(source.dir)) {
    throw new Error(
      `spec source dir is set but does not exist: ${source.dir}`
    );
  }
  return source;
}

/**
 * True when this run reads specs from anywhere other than the committed
 * default config — env vars or a spec-source.local.json. Guardrail hook for
 * sync-openapi (DO-NOT-COMMIT warning) and drift-check (manifest-source check).
 */
export function isOverrideActive() {
  return Boolean(
    process.env.OPENAPI_SOURCE_DIR ||
      process.env.OPENAPI_SOURCE_URL ||
      existsSync(SPEC_SOURCE_LOCAL_PATH)
  );
}

/** Human-readable form of a source, for log lines. */
export function describeSource(source) {
  if (source.kind === "dir") return source.dir;
  const pinned = Object.keys(source.urls ?? {}).length;
  return pinned > 0
    ? `${source.baseUrl} (+${pinned} per-file URL${pinned === 1 ? "" : "s"})`
    : source.baseUrl;
}

/**
 * Read one spec file from the resolved source.
 *
 * @param {ReturnType<typeof resolveSpecSource>} source
 * @param {string} fileName  e.g. "Api_Swagger.yaml"
 * @returns {Promise<Buffer>} raw spec bytes
 * @throws  {Error} on a missing file or non-200 HTTP response — callers are
 *                  expected to let this fail the run (exit ≠ 0).
 */
export async function fetchSpec(source, fileName) {
  if (source.kind === "dir") {
    const path = join(source.dir, fileName);
    if (!existsSync(path)) {
      throw new Error(`spec not found in source dir: ${path}`);
    }
    return readFileSync(path);
  }

  const url = source.urls?.[fileName] ?? `${source.baseUrl}/${fileName}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch ${url} — HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
