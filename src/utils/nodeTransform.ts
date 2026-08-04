/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ESPRMNeoAttributeInterface,
  ESPRMNeoAttributeAPI,
  ESPRMNeoParamAPI,
  ESPRMNeoDeviceAPI,
  ESPRMNeoServiceAPI,
  ESPRMNeoExtractedShadow,
  ESPRMNeoShadowDocument,
  ESPRMNeoNodeInfoAPI,
  ESPRMNeoNodeInfoInterface,
} from "../types/node";

/**
 * Transforms a raw API attribute to the shape used by {@link ESPRMNeoDevice}.
 */
export function transformApiAttributeForNodeDevice(
  attr: ESPRMNeoAttributeAPI
): ESPRMNeoAttributeInterface {
  return {
    name: attr.name ?? "",
    value: attr.value,
  };
}

/**
 * Camelcase fallbacks for params read back from a node-config cache written
 * by older SDK versions, which persisted the runtime instances (camelCase)
 * instead of the raw API config (snake_case). Reading both shapes heals
 * those caches in place — without this, such params lose dataType/uiType
 * until the next cloud sync.
 */
type ESPRMNeoCachedParamShape = {
  dataType?: string;
  uiType?: string;
  validStrings?: string[];
};

/**
 * Transforms a raw API param to device param input for {@link ESPRMNeoDevice}.
 * Tolerates both the API shape (snake_case) and the legacy cached runtime
 * shape (camelCase, see {@link ESPRMNeoCachedParamShape}).
 */
export function transformApiParamForNodeDevice(
  p: ESPRMNeoParamAPI
): {
  id: string;
  type: string;
  properties: string[];
  dataType: string;
  uiType?: string;
  bounds?: ESPRMNeoParamAPI["bounds"];
  validStrings?: string[];
} {
  const cached = p as ESPRMNeoParamAPI & ESPRMNeoCachedParamShape;
  return {
    id: p.id,
    type: p.type ?? p.id,
    properties: p.properties ?? [],
    dataType: p.data_type ?? cached.dataType,
    uiType: p.ui_type ?? cached.uiType,
    bounds: p.bounds,
    validStrings: p.valid_strings ?? cached.validStrings,
  };
}

/**
 * Transforms a raw API param to service param input for {@link ESPRMNeoService}.
 * Tolerates both the API shape (snake_case) and the legacy cached runtime
 * shape (camelCase, see {@link ESPRMNeoCachedParamShape}).
 */
export function transformApiParamForNodeService(
  p: ESPRMNeoParamAPI
): {
  id: string;
  type: string;
  properties: string[];
  dataType: string;
  bounds?: ESPRMNeoParamAPI["bounds"];
  validStrings?: string[];
} {
  const cached = p as ESPRMNeoParamAPI & ESPRMNeoCachedParamShape;
  return {
    id: p.id,
    type: p.type ?? p.id,
    properties: p.properties ?? [],
    dataType: p.data_type ?? cached.dataType,
    bounds: p.bounds,
    validStrings: p.valid_strings ?? cached.validStrings,
  };
}

/**
 * Builds the first constructor argument for {@link ESPRMNeoDevice} from API data.
 * Trusts the wire/API shape (`id`, `type`, …) — callers pass cloud or cache
 * config already resolved before {@link ESPRMNeoNode} construction.
 */
export function transformNodeDevice(
  d: ESPRMNeoDeviceAPI
): {
  name: string;
  displayName: string;
  type: string;
  primary: string;
  attributes?: ESPRMNeoAttributeInterface[];
  params: ReturnType<typeof transformApiParamForNodeDevice>[];
} {
  const name = d.id;
  return {
    name,
    displayName: name,
    type: d.type ?? "esp.device.generic",
    primary: d.primary,
    attributes: d.attributes?.map(transformApiAttributeForNodeDevice),
    params: (d.params ?? []).map(transformApiParamForNodeDevice),
  };
}

/**
 * Builds the first constructor argument for {@link ESPRMNeoService} from API data.
 * Trusts the wire/API shape (`id`, `type`, …) — same as {@link transformNodeDevice}.
 */
export function transformNodeService(
  s: ESPRMNeoServiceAPI
): {
  name: string;
  type: string;
  params: ReturnType<typeof transformApiParamForNodeService>[];
} {
  return {
    name: s.id,
    type: s.type ?? "",
    params: (s.params ?? []).map(transformApiParamForNodeService),
  };
}

/**
 * Transforms a raw node config `info` block ({@link ESPRMNeoNodeInfoAPI}) to
 * {@link ESPRMNeoNodeInfoInterface}. The mapped `firmwareVersion` is added
 * alongside the raw wire keys (`fw_version` is kept via the spread), so
 * re-transforming an already-transformed object is a no-op.
 * Returns `undefined` when `raw` is missing or not an object.
 */
export function transformNodeInfo(
  raw?: ESPRMNeoNodeInfoAPI | null
): (ESPRMNeoNodeInfoInterface & ESPRMNeoNodeInfoAPI) | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return {
    ...raw,
    type: raw.type ?? "",
    model: raw.model ?? "",
    firmwareVersion: raw.fw_version,
    readme: raw.readme as string | undefined,
  };
}

/**
 * Params and connectivity from a shadow / reported-state JSON payload.
 */
export function extract(json: ESPRMNeoShadowDocument): ESPRMNeoExtractedShadow {
  const reported = json?.state?.reported;
  return {
    params: reported?.params || {},
    connectivityStatus: {
      isConnected: reported?.online || false,
      lastConnectionTimestamp:
        reported?.disconnect_info?.last_disconnect_ts || 0,
    },
    configVersion: String(reported?.ncfg_ver ?? "") || "",
  };
}
