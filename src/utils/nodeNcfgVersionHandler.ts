/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoStorage } from "../services/ESPRMNeoStorage/ESPRMNeoStorage";
import type { ESPRMNeoShadowDocument } from "../types/node";
import { coerceToString } from "./coerce";
import { asObject } from "./common";
import { StorageKeys } from "./constants";
import { Logger } from "./logger";

const logger = new Logger("nodeNcfgVersionHandler");

/**
 * ncfg_ver bookkeeping.
 *
 * Every ESP node publishes a `state.reported.ncfg_ver` string in its IoT
 * shadow — a lowercase hex SHA256 of the generated node config. Firmware
 * updates it whenever the node's configuration schema (devices, services,
 * params, metadata) changes. The SDK tracks the last-seen value per node so
 * it can detect a genuine schema change on the next shadow update and refresh
 * its cached config.
 *
 * Legacy firmwares emit an integer timestamp; those are normalized to their
 * string form so the mismatch comparison stays uniform.
 *
 * Cached versions are persisted as a single JSON blob under
 * {@link StorageKeys.NCFG_VERSIONS} — `{ [nodeId]: string, ... }` — so cleanup
 * on logout is one storage write, no key enumeration required.
 */

type CachedVersions = Record<string, string>;

/** Reads the cached ncfg_ver map from storage; returns `{}` if none or unparseable. */
async function getNcfgCachedVersion(): Promise<CachedVersions> {
  try {
    const raw = await ESPRMNeoStorage.getItem(StorageKeys.NCFG_VERSIONS);
    if (!raw) return {};
    return asObject<CachedVersions>(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Persists the cached ncfg_ver map. */
async function saveNcfgCachedVersion(
  cachedVersions: CachedVersions
): Promise<void> {
  await ESPRMNeoStorage.setItem(
    StorageKeys.NCFG_VERSIONS,
    JSON.stringify(cachedVersions)
  );
}

/**
 * Reads `ncfg_ver` from an IoT shadow document's `state.reported`.
 *
 * Legacy integer timestamps from older firmware are normalized to strings.
 */
export function getNcfgVersion(shadow: ESPRMNeoShadowDocument): string | null {
  return coerceToString(shadow.state?.reported?.ncfg_ver) ?? null;
}

/**
 * Returns true when the shadow's `ncfg_ver` differs from the last cached
 * version for this node. On first sighting, persists a baseline and returns
 * false (no refresh needed).
 */
export async function hasNcfgVersionChanged(
  nodeId: string,
  shadow: ESPRMNeoShadowDocument
): Promise<boolean> {
  const current = getNcfgVersion(shadow);
  if (current == null) return false;

  const cachedVersions = await getNcfgCachedVersion();
  const prev = cachedVersions[nodeId];

  // First sighting → baseline only.
  if (prev === undefined) {
    cachedVersions[nodeId] = current;
    try {
      await saveNcfgCachedVersion(cachedVersions);
    } catch {
      /* ignore */
    }
    return false;
  }

  return prev !== current;
}

/**
 * Persists the shadow's `ncfg_ver` as the last-seen cached version for this node.
 * Call after a successful config refresh when {@link hasNcfgVersionChanged}
 * returned true.
 */
export async function persistNcfgVersionMarker(
  nodeId: string,
  shadow: ESPRMNeoShadowDocument
): Promise<void> {
  const current = getNcfgVersion(shadow);
  if (current == null) return;

  const cachedVersions = await getNcfgCachedVersion();
  cachedVersions[nodeId] = current;
  try {
    await saveNcfgCachedVersion(cachedVersions);
  } catch {
    /* ignore */
  }
}

/**
 * Removes the cached ncfg_ver for a single node. Call after
 * `group.removeNode()` so the entry doesn't outlive the node in storage.
 */
export async function clearNcfgVersionMarker(nodeId: string): Promise<void> {
  const cachedVersions = await getNcfgCachedVersion();
  if (!(nodeId in cachedVersions)) return;
  delete cachedVersions[nodeId];
  try {
    await saveNcfgCachedVersion(cachedVersions);
  } catch {
    /* ignore */
  }
}

/**
 * Removes every cached ncfg_ver. Call on logout / session reset.
 * Returns the list of node ids whose entries were cleared, so callers can
 * follow up (e.g. delete the corresponding node-config cache entries).
 */
export async function clearAllNcfgVersionMarkers(): Promise<string[]> {
  const cachedVersions = await getNcfgCachedVersion();
  const ids = Object.keys(cachedVersions);
  if (ids.length === 0) return [];
  try {
    await ESPRMNeoStorage.removeItem(StorageKeys.NCFG_VERSIONS);
  } catch (error) {
    logger.debug("Failed to clear cached ncfg versions", error);
  }
  return ids;
}

/**
 * Returns the list of node ids the SDK is currently tracking cached versions for.
 * Callers can use it to enumerate related caches at logout time without
 * needing the storage adapter to support key listing.
 */
export async function listTrackedNodeIds(): Promise<string[]> {
  return Object.keys(await getNcfgCachedVersion());
}
