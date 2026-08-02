/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AWS IoT Shadow topic and payload helpers for MQTT orchestrator.
 * Handles topic construction, parsing, and state extraction from shadow messages.
 */

import { asObject } from "./common";

/** Topic format: $aws/things/NODE_ID/shadow/name/SHADOW_NAME/... */
const TOPIC_PARTS = {
  PREFIX: "$aws/things",
  NODE_ID_INDEX: 2,
} as const;

/**
 * Builds the base shadow topic path for a node.
 *
 * @param nodeId - The device/node identifier
 * @param shadowName - The named shadow (e.g. params-groupId-subgroupId)
 * @returns Topic path: $aws/things/{nodeId}/shadow/name/{shadowName}
 */
export function buildShadowBase(
  nodeId: string,
  shadowName: string
): string {
  return `${TOPIC_PARTS.PREFIX}/${nodeId}/shadow/name/${shadowName}`;
}

/**
 * Suffixes for group-wide shadow subscriptions (RainMakerNeo User MQTT API + GET).
 * Wildcard thing name: `$aws/things/+/shadow/name/{shadowName}{suffix}`.
 *
 * RECEIVE (API 1.0.0): update/documents, update/delta, update/accepted, update/rejected.
 * GET (request/response): get/accepted, get/rejected.
 */
const SHADOW_GROUP_SUFFIXES = [
  "/update/documents",
  "/update/delta",
  "/update/accepted",
  "/update/rejected",
  "/get/accepted",
  "/get/rejected",
] as const;

/**
 * Builds all wildcard topics for a named shadow (any thing / node id).
 */
export function buildShadowGroupWildcardTopics(shadowName: string): string[] {
  return SHADOW_GROUP_SUFFIXES.map(
    (suffix) => `${TOPIC_PARTS.PREFIX}/+/shadow/name/${shadowName}${suffix}`
  );
}

/**
 * RainMaker user params channel (publish / optional subscribe).
 * @see rainmaker/nodes/{nodeId}/user/{shadowName}/params
 */
export function buildRainMakerUserParamsTopic(
  nodeId: string,
  shadowName: string
): string {
  return `rainmaker/nodes/${nodeId}/user/${shadowName}/params`;
}

/**
 * RainMaker **group control** topic (multicast to all nodes in a group or subgroup).
 *
 * - Broadcast (all devices in the group):
 *   `rainmaker/nodes/groups/<groupId>/control`
 * - Single subgroup:
 *   `rainmaker/nodes/groups/<groupId>/subgroups/<subgroupId>/control`
 *
 * @param groupId - Primary group id (`pgrp`)
 * @param subgroupId - Optional subgroup id; when set, targets that subgroup only
 */
export function buildGroupControlParamsTopic(
  groupId: string,
  subgroupId?: string
): string {
  if (subgroupId) {
    return `rainmaker/nodes/groups/${groupId}/subgroups/${subgroupId}/control`;
  }
  return `rainmaker/nodes/groups/${groupId}/control`;
}

/**
 * Extracts device params from a shadow GET/accepted document.
 * Prefers `state.reported.params` when present; otherwise `state.reported`.
 * Always returns an object (`{}` when absent / non-object).
 */
export function getReportedParamsFromShadowDocument(
  parsed: unknown
): Record<string, unknown> {
  const reported = asObject(
    (parsed as { state?: { reported?: unknown } })?.state?.reported
  );
  return "params" in reported ? asObject(reported.params) : reported;
}

/**
 * Normalizes a live shadow MQTT payload for param listeners.
 *
 * - `/update/documents`: returns `current` (full shadow doc with previous+current
 *   envelope unwrapped so callers see the usual `{ state, metadata, version }` shape).
 * - Other topics: returns the parsed payload as received.
 * Always returns an object (`{}` when absent / non-object).
 */
export function getReportedParamsFromShadowLiveMessage<
  T extends Record<string, unknown> = Record<string, unknown>
>(topic: string, parsed: unknown): T {
  if (topic.endsWith("/update/documents")) {
    return asObject<T>((parsed as { current?: unknown })?.current);
  }
  return asObject<T>(parsed);
}

/**
 * Extracts the nodeId from an AWS IoT shadow topic.
 * Topic format: $aws/things/NODE_ID/shadow/name/SHADOW_NAME/...
 *
 * @param topic - The MQTT topic string
 * @returns The nodeId, or null if topic format is invalid
 */
export function extractNodeIdFromTopic(topic: string): string | null {
  const parts = topic.split("/");
  return parts[TOPIC_PARTS.NODE_ID_INDEX] ?? null;
}

/**
 * Safely parses a shadow message buffer to JSON.
 *
 * @param message - Raw MQTT payload buffer
 * @returns Parsed shadow document, or null on parse error
 */
export function parseShadowMessage(
  message: Buffer
): { state?: { reported?: unknown; desired?: unknown } } | null {
  try {
    return JSON.parse(message.toString()) as {
      state?: { reported?: unknown; desired?: unknown };
    };
  } catch {
    return null;
  }
}

/**
 * Extracts the full state object from a parsed shadow payload.
 *
 * @param parsed - Parsed shadow document (or null)
 * @returns The state object (reported + desired), or `{}` when absent / non-object
 */
export function getStateFromPayload<
  T extends Record<string, unknown> = Record<string, unknown>
>(parsed: unknown): T {
  if (parsed == null) return asObject<T>(parsed);
  const payload = parsed as { state?: unknown };
  return asObject<T>(payload.state ?? parsed);
}

/**
 * Builds the JSON payload for a shadow update (desired state).
 *
 * @param desiredParams - The desired state parameters to set
 * @returns JSON string for MQTT publish
 */
export function buildShadowUpdatePayload(desiredParams: unknown): string {
  return JSON.stringify({ state: { desired: desiredParams } });
}
