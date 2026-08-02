/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal AsyncAPI 3.1 support.
 *
 * The vendored MQTT/push specs only use *internal* `$ref`s
 * (`#/components/...`), so a full AsyncAPI parser is unnecessary — a YAML
 * parse plus a local JSON-pointer resolver covers everything the schema
 * generator and drift checker need. If the backend ever publishes specs
 * with cross-file refs, revisit with @asyncapi/parser.
 */

import * as yaml from "js-yaml";

/** Look up an internal `#/a/b/c` JSON pointer in `doc`. */
function resolvePointer(doc, ref) {
  const parts = ref.slice(2).split("/").map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let node = doc;
  for (const part of parts) {
    node = node?.[part];
    if (node === undefined) {
      throw new Error(`Unresolvable $ref "${ref}" (stopped at "${part}")`);
    }
  }
  return node;
}

/**
 * Deep-resolve every internal `$ref` in `value` against `doc`.
 * Cycle-safe: a ref already being expanded is left as-is (fingerprints stay
 * deterministic either way).
 */
function derefValue(doc, value, stack = new Set()) {
  if (Array.isArray(value)) return value.map((v) => derefValue(doc, v, stack));
  if (value === null || typeof value !== "object") return value;

  if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
    if (stack.has(value.$ref)) return value; // cycle — keep the ref
    const next = new Set(stack);
    next.add(value.$ref);
    return derefValue(doc, resolvePointer(doc, value.$ref), next);
  }

  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = derefValue(doc, v, stack);
  return out;
}

/**
 * Parse an AsyncAPI YAML document and return a fully locally-dereferenced
 * clone. Throws on unresolvable refs — a broken spec must not silently
 * produce empty schemas.
 */
export function loadAsyncapi(yamlText) {
  const doc = yaml.load(yamlText);
  return derefValue(doc, doc);
}

/**
 * The drift/validation surface of an AsyncAPI spec, given its config entry:
 *   messages: { "<name>": <dereferenced payload schema> }
 *   channels: { "<name>": { address, messages: [names…] } }
 */
export function asyncapiSurface(dereferencedDoc, specCfg) {
  const messages = {};
  for (const name of specCfg.messages ?? []) {
    const msg = dereferencedDoc.components?.messages?.[name];
    if (!msg?.payload) {
      throw new Error(`Message "${name}" not found (or has no payload) in ${specCfg.specFile}`);
    }
    messages[name] = msg.payload;
  }

  const channels = {};
  for (const [name, ch] of Object.entries(dereferencedDoc.channels ?? {})) {
    channels[name] = {
      address: ch.address ?? null,
      messages: Object.keys(ch.messages ?? {}).sort(),
    };
  }

  return { messages, channels };
}
