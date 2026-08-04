/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Selftest for the spec-source resolution rules. Runs on `node --test`
 * via `npm run schema:selftest` — Jest/ts-jest does not ingest .mjs ESM.
 *
 * Exercises the PURE core (`resolveSpecSourceFrom`) so no repo files or env
 * vars are touched; the file/env plumbing is a thin shell around it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { describeSource, resolveSpecSourceFrom } from "./spec-source.mjs";

const COMMITTED = {
  baseUrl: "https://committed.example/swagger",
  urls: { "MQTT_Node.yaml": "https://committed.example/mqtt/MQTT_Node.yaml" },
};

test("no overrides → committed config, not an override", () => {
  const src = resolveSpecSourceFrom({
    env: {},
    localCfg: null,
    committedCfg: COMMITTED,
  });
  assert.deepEqual(src, {
    kind: "url",
    baseUrl: COMMITTED.baseUrl,
    urls: COMMITTED.urls,
    isOverride: false,
  });
});

test("$OPENAPI_SOURCE_DIR wins over everything", () => {
  const src = resolveSpecSourceFrom({
    env: { OPENAPI_SOURCE_DIR: "/tmp/specs", OPENAPI_SOURCE_URL: "https://x" },
    localCfg: { baseUrl: "https://local.example" },
    committedCfg: COMMITTED,
  });
  assert.deepEqual(src, { kind: "dir", dir: "/tmp/specs", isOverride: true });
});

test("$OPENAPI_SOURCE_URL is a full replacement — config per-file urls do not leak in", () => {
  const src = resolveSpecSourceFrom({
    env: { OPENAPI_SOURCE_URL: "https://oneoff.example" },
    localCfg: { urls: { "Api_Swagger.yaml": "https://local.example/api.yaml" } },
    committedCfg: COMMITTED,
  });
  assert.deepEqual(src, {
    kind: "url",
    baseUrl: "https://oneoff.example",
    urls: {},
    isOverride: true,
  });
});

test("local file: dir wins within the file", () => {
  const src = resolveSpecSourceFrom({
    env: {},
    localCfg: { dir: "/work/backend/specs", baseUrl: "https://ignored" },
    committedCfg: COMMITTED,
  });
  assert.deepEqual(src, {
    kind: "dir",
    dir: "/work/backend/specs",
    isOverride: true,
  });
});

test("local file: baseUrl falls back to committed; per-file urls merge, local wins", () => {
  const src = resolveSpecSourceFrom({
    env: {},
    localCfg: {
      urls: { "MQTT_Node.yaml": "https://local.example/MQTT_Node.yaml" },
    },
    committedCfg: COMMITTED,
  });
  assert.equal(src.baseUrl, COMMITTED.baseUrl);
  assert.deepEqual(src.urls, {
    "MQTT_Node.yaml": "https://local.example/MQTT_Node.yaml",
  });
  assert.equal(src.isOverride, true);
});

test("describeSource notes pinned per-file URLs", () => {
  const plain = resolveSpecSourceFrom({
    env: {},
    localCfg: null,
    committedCfg: { baseUrl: "https://committed.example/swagger" },
  });
  assert.equal(describeSource(plain), "https://committed.example/swagger");

  const pinned = resolveSpecSourceFrom({
    env: {},
    localCfg: null,
    committedCfg: COMMITTED,
  });
  assert.equal(
    describeSource(pinned),
    "https://committed.example/swagger (+1 per-file URL)"
  );
});
