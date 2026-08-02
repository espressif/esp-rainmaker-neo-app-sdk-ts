/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { asObject } from "./common";

/** Minimal param shape needed to apply live values. */
export interface ParamWithValue {
  id: string;
  value?: unknown;
}

/** Named device/service host with params that can receive live values. */
export interface NodeParamEntity {
  name: string;
  params: ParamWithValue[];
}

/** Device/service host used when applying a full params snapshot. */
export interface NodeParamHost {
  devices: NodeParamEntity[];
  services: NodeParamEntity[];
}

/**
 * Writes values from a map onto matching param instances.
 * Params whose id is absent from the map are left unchanged.
 */
export function applyValuesToParams(
  params: ParamWithValue[],
  values: unknown
): void {
  const map = asObject(values);
  for (const p of params) {
    if (Object.prototype.hasOwnProperty.call(map, p.id)) {
      p.value = map[p.id];
    }
  }
}

/**
 * Writes a params snapshot (`entityName → { paramId → value }`) onto matching
 * device/service param instances.
 */
export function applyParamValues(
  node: NodeParamHost,
  values: Record<string, unknown>
): void {
  for (const [name, raw] of Object.entries(values)) {
    const device = node.devices.find((d) => d.name === name);
    if (device) {
      applyValuesToParams(device.params, raw);
      continue;
    }
    const service = node.services.find((s) => s.name === name);
    if (service) {
      applyValuesToParams(service.params, raw);
    }
  }
}

/**
 * Deep-merges an incoming params map onto a previous one (per entity name).
 * Partial updates (e.g. only `Switch.Power`) keep sibling entities/params.
 */
export function mergeParamMaps(
  previous: unknown,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const prev = asObject(previous);
  const next: Record<string, unknown> = { ...prev };
  for (const [name, raw] of Object.entries(incoming)) {
    next[name] = {
      ...asObject(prev[name]),
      ...asObject(raw),
    };
  }
  return next;
}
