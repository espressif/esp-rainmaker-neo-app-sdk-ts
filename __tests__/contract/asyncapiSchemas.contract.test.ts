/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Contract tests for the AsyncAPI-derived schemas: MQTT and
 * push message payloads carry the same validated() guarantees as REST.
 *
 * The strongest self-consistency check needs no hand-written fixtures at
 * all: every example the backend team put in the spec must validate against
 * the schema of its own message.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as yaml from "js-yaml";

import {
  assertValidSchema,
  availableSchemas,
  validateAgainstSchema,
  type SchemaName,
} from "../../test-utils/schema-validator";

const OPENAPI_DIR = join(__dirname, "..", "..", "contracts", "openapi");

interface AsyncapiMessage {
  payload?: unknown;
  examples?: { name?: string; payload?: unknown }[];
}

function messagesOf(specFile: string): Record<string, AsyncapiMessage> {
  const doc = yaml.load(readFileSync(join(OPENAPI_DIR, specFile), "utf8")) as {
    components?: { messages?: Record<string, AsyncapiMessage> };
  };
  return doc.components?.messages ?? {};
}

const SPECS: { file: string; prefix: string }[] = [
  { file: "MQTT_User.yaml", prefix: "mqtt" },
  { file: "Push_User.yaml", prefix: "push" },
];

describe("Contract: AsyncAPI message schemas", () => {
  it("exports every configured MQTT/push message schema into the bundle", () => {
    const names = availableSchemas().map(String);
    expect(names.filter((n) => n.startsWith("mqtt:")).length).toBe(6);
    expect(names.filter((n) => n.startsWith("push:")).length).toBe(2);
    expect(names).toContain("shadowDocument");
    expect(names).toContain("ApnsPayload");
  });

  describe("every example in the spec validates against its own message schema", () => {
    for (const { file, prefix } of SPECS) {
      for (const [msgName, msg] of Object.entries(messagesOf(file))) {
        for (const [i, example] of (msg.examples ?? []).entries()) {
          if (example.payload === undefined) continue;
          it(`${file} ${msgName} example[${i}] "${example.name ?? ""}"`, () => {
            assertValidSchema(
              `${prefix}:${msgName}` as SchemaName,
              example.payload
            );
          });
        }
      }
    }
  });

  it("rejects a shadow-documents payload with the wrong shape", () => {
    // `current` must be a shadowDocument object, not a string.
    const result = validateAgainstSchema(
      "mqtt:shadowUpdateDocumentsMessage" as SchemaName,
      { current: "not-a-document" }
    );
    expect(result.valid).toBe(false);
  });

  it("free-form param payloads stay open even in closed-world mode", () => {
    // paramControlMessage is additionalProperties: true by design — device
    // params are inherently free-form; closed-world must respect that.
    const result = validateAgainstSchema(
      "mqtt:paramControlMessage" as SchemaName,
      { Light: { Power: true, Brightness: 80 } },
      { closedWorld: true }
    );
    expect(result.valid).toBe(true);
  });
});
