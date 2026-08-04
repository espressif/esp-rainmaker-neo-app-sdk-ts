/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPNodeUpdateData } from "../../types/subscription";
import { getReportedParamsFromShadowDocument } from "../../utils/awsShadowTopics";
import { SubscriptionChannelIds } from "../../utils/constants";

/**
 * Canonical event type emitted when a node's parameters change.
 */
export const NODE_PARAMS_CHANGED_EVENT = "rmneo.event.node_params_changed";

/**
 * Normalizes a parsed AWS IoT shadow document into the canonical
 * {@link ESPNodeUpdateData} envelope used by every subscription channel.
 *
 * The `payload` is reduced to the device→param map
 * (`{ <deviceName>: { <paramName>: value } }`) by preferring
 * `state.reported.params` and falling back to `state.reported`, so all channels
 * agree on the same payload shape regardless of transport.
 *
 * The full parsed shadow is also attached as `metadata.shadow` so consumers that
 * need fields outside the param map (e.g. `online`, `ncfg_ver`) can read them
 * without changing the normalized `payload` contract.
 *
 * @param nodeId - The node the update belongs to.
 * @param parsedShadow - The parsed shadow document (full live message or get/accepted document).
 * @param meta - Channel-specific metadata to merge into `metadata` (e.g. `{ shadowName, topic }`).
 * @param source - The originating channel id (defaults to the MQTT channel).
 * @returns A normalized `ESPNodeUpdateData`.
 */
export function transformShadowToNodeUpdate(
  nodeId: string,
  parsedShadow: unknown,
  meta: Record<string, unknown> = {},
  source: string = SubscriptionChannelIds.MQTT
): ESPNodeUpdateData {
  const payload = getReportedParamsFromShadowDocument(parsedShadow);

  const shadow = (parsedShadow ?? {}) as {
    version?: unknown;
    timestamp?: unknown;
  };

  return {
    nodeId,
    source,
    eventType: NODE_PARAMS_CHANGED_EVENT,
    payload,
    metadata: {
      ...meta,
      version: shadow.version,
      timestamp: shadow.timestamp,
      // Full parsed shadow, for consumers (e.g. ESPRMNeoNode) that need fields
      // beyond the param map such as `online` / `ncfg_ver`.
      shadow: parsedShadow,
    },
  };
}
