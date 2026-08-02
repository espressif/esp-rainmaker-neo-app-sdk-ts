/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Runtime schema validator backed by the OpenAPI-derived schema bundle
 * (`contracts/openapi/generated/schemas.json`).
 *
 * Use it in tests to assert that a payload — a fixture, or a real API response
 * in contract tests — matches the shape the backend promises in its spec. This
 * is the mechanism that prevents "mock drift": fixtures and responses are both
 * checked against the same generated schema, which is regenerated from the
 * source-of-truth OpenAPI document.
 */

import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import bundle from "../../contracts/openapi/generated/schemas.json";

type SchemaMap = typeof bundle.schemas;
export type SchemaName = keyof SchemaMap;

// Strict mode — AJV refuses to compile suspicious schemas (typo'd or
// unknown keywords, ambiguous constructs), so a generator bug cannot produce
// a schema that silently validates nothing. `strictRequired` stays off: the
// spec legitimately uses the OpenAPI "properties at the parent, oneOf with
// bare `required`" pattern (e.g. SignupRequest's email-XOR-phone), which that
// sub-flag would false-positive on.
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);

function refId(name: string): string {
  return `#/components/schemas/${name}`;
}

// Register every exported schema so inter-schema $refs resolve.
for (const [name, schema] of Object.entries(bundle.schemas)) {
  ajv.addSchema(schema as object, refId(name));
}

// ---------------------------------------------------------------------------
// Closed-world mode — reject fields the spec does not declare.
//
// The spec's schemas rarely set `additionalProperties`, so open-world (lax)
// validation accepts payloads with extra/renamed keys — the exact drift class
// this framework exists to catch (real example: a fixture with all
// its fields nested under a bogus `payload` key passed validation). The
// closed-world variant deep-applies `additionalProperties: false` to every
// object schema that declares `properties`, flattening `allOf` merges first
// (naively closing each allOf branch would make every valid payload fail,
// because one branch rejects the other branch's fields).
//
// Mode selection: RMNEO_CLOSED_WORLD=1 flips validated()/assertValidSchema()
// suite-wide (no call-site changes); the `closedWorld` option overrides per
// call. Explicit `additionalProperties` in the spec (e.g. free-form device
// params with `additionalProperties: true`) is always respected.
// ---------------------------------------------------------------------------

const CLOSED_WORLD_ENV = process.env.RMNEO_CLOSED_WORLD === "1";

type JsonSchema = Record<string, unknown>;

/** Merge all `allOf` branches of an object schema into one flat schema. */
function flattenAllOf(schema: JsonSchema): JsonSchema {
  if (!Array.isArray(schema.allOf)) return schema;
  const { allOf, ...rest } = schema;
  const merged: JsonSchema = { ...rest };
  for (const rawBranch of allOf as JsonSchema[]) {
    const branch = flattenAllOf(rawBranch);
    for (const [key, value] of Object.entries(branch)) {
      if (key === "properties") {
        merged.properties = {
          ...(merged.properties as JsonSchema | undefined),
          ...(value as JsonSchema),
        };
      } else if (key === "required") {
        merged.required = [
          ...new Set([
            ...((merged.required as string[] | undefined) ?? []),
            ...(value as string[]),
          ]),
        ];
      } else if (!(key in merged)) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

/** Recursively apply closed-world semantics to a (cloned) schema. */
function closeWorld(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(closeWorld);
  if (node === null || typeof node !== "object") return node;

  const schema = flattenAllOf({ ...(node as JsonSchema) });

  for (const key of ["properties", "patternProperties", "definitions"]) {
    if (schema[key] && typeof schema[key] === "object") {
      schema[key] = Object.fromEntries(
        Object.entries(schema[key] as JsonSchema).map(([k, v]) => [
          k,
          closeWorld(v),
        ])
      );
    }
  }
  for (const key of ["items", "not", "additionalProperties"]) {
    if (schema[key] && typeof schema[key] === "object") {
      schema[key] = closeWorld(schema[key]);
    }
  }
  for (const key of ["oneOf", "anyOf"]) {
    if (Array.isArray(schema[key])) {
      schema[key] = (schema[key] as unknown[]).map(closeWorld);
    }
  }

  // Close only object schemas that declare properties and do not already take
  // a position on additionalProperties. Property-less objects (free-form maps)
  // and explicit `additionalProperties: true` stay open — that is the spec
  // author's stated intent, not an omission.
  if (
    schema.properties &&
    schema.additionalProperties === undefined &&
    (schema.type === "object" || schema.type === undefined)
  ) {
    schema.additionalProperties = false;
  }

  return schema;
}

const closedAjv = new Ajv({
  allErrors: true,
  strict: true,
  strictRequired: false,
});
addFormats(closedAjv);
for (const [name, schema] of Object.entries(bundle.schemas)) {
  closedAjv.addSchema(
    closeWorld(JSON.parse(JSON.stringify(schema))) as object,
    refId(name)
  );
}

const validatorCache = new Map<string, ValidateFunction>();

function getValidator(name: SchemaName, closedWorld: boolean): ValidateFunction {
  const instance = closedWorld ? closedAjv : ajv;
  const cacheKey = `${closedWorld ? "closed" : "open"}:${refId(name as string)}`;
  let validate = validatorCache.get(cacheKey);
  if (!validate) {
    const found = instance.getSchema(refId(name as string));
    if (!found) {
      throw new Error(
        `Unknown schema "${String(name)}". Available: ${Object.keys(
          bundle.schemas
        ).join(", ")}`
      );
    }
    validate = found as ValidateFunction;
    validatorCache.set(cacheKey, validate);
  }
  return validate;
}

export interface SchemaValidationOptions {
  /** Reject fields the spec does not declare. Defaults to RMNEO_CLOSED_WORLD=1. */
  closedWorld?: boolean;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: ErrorObject[];
  errorText: string;
}

/** Validate `data` against a named OpenAPI schema. Never throws. */
export function validateAgainstSchema(
  name: SchemaName,
  data: unknown,
  opts: SchemaValidationOptions = {}
): SchemaValidationResult {
  const closedWorld = opts.closedWorld ?? CLOSED_WORLD_ENV;
  const validate = getValidator(name, closedWorld);
  const valid = validate(data) as boolean;
  const errors = (validate.errors ?? []) as ErrorObject[];
  return {
    valid,
    errors,
    errorText: valid ? "" : ajv.errorsText(errors, { separator: "\n  " }),
  };
}

/** Assert `data` matches a named schema; throws a readable error otherwise. */
export function assertValidSchema(
  name: SchemaName,
  data: unknown,
  opts: SchemaValidationOptions = {}
): void {
  const result = validateAgainstSchema(name, data, opts);
  if (!result.valid) {
    const mode = (opts.closedWorld ?? CLOSED_WORLD_ENV) ? " (closed-world)" : "";
    throw new Error(
      `Schema validation failed for "${String(name)}"${mode}:\n  ${result.errorText}`
    );
  }
}

/** All schema names available in the bundle (handy for coverage assertions). */
export function availableSchemas(): SchemaName[] {
  return Object.keys(bundle.schemas) as SchemaName[];
}

// ---------------------------------------------------------------------------
// Request-body validation.
//
// schema:gen exports the request-body schema of every tracked operation under
// a `request:METHOD /path/{template}` key. The lookup below is
// placeholder-name agnostic (`{groupId}` vs `:groupId` vs `{subGroupId}` all
// normalise to `{}`), so tests and the mock server can use their own naming.
// ---------------------------------------------------------------------------

/** `/v1/groups/{groupId}` or `/v1/groups/:groupId` → `/v1/groups/{}` */
function normalizePathTemplate(template: string): string {
  return template
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{}");
}

const requestSchemaIndex = new Map<string, SchemaName>();
for (const name of Object.keys(bundle.schemas)) {
  if (!name.startsWith("request:")) continue;
  const [method, ...pathParts] = name.slice("request:".length).split(" ");
  requestSchemaIndex.set(
    `${method.toUpperCase()} ${normalizePathTemplate(pathParts.join(" "))}`,
    name as SchemaName
  );
}

/**
 * The bundle's request-body schema for an operation, or undefined when the
 * operation is untracked or has no JSON request body.
 */
export function requestSchemaFor(
  method: string,
  pathTemplate: string
): SchemaName | undefined {
  return requestSchemaIndex.get(
    `${method.toUpperCase()} ${normalizePathTemplate(pathTemplate)}`
  );
}

/**
 * Assert that a request body the SDK built matches the spec's request schema
 * for the operation. `opKey` is `"METHOD /path/{template}"` with any
 * placeholder names, e.g. `expectValidRequest("POST /v1/groups", body)`.
 * Throws when the operation has no exported request schema — a typo'd key
 * must not silently pass.
 */
export function expectValidRequest(
  opKey: string,
  body: unknown,
  opts: SchemaValidationOptions = {}
): void {
  const spaceAt = opKey.indexOf(" ");
  const method = opKey.slice(0, spaceAt);
  const template = opKey.slice(spaceAt + 1);
  const schema = requestSchemaFor(method, template);
  if (!schema) {
    throw new Error(
      `No request schema for "${opKey}". Either the operation is not tracked ` +
        `with requestBody: true in config.mjs, or the key is misspelled. ` +
        `Known request schemas:\n  ${[...requestSchemaIndex.values()].join("\n  ")}`
    );
  }
  assertValidSchema(schema, body, opts);
}
