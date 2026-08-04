/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Public SDK service surface.
 *
 * Two categories of "internal" code, treated differently:
 *
 * 1. Stateful services (API managers, storage, MQTT engines, transports,
 *    orchestrators) — kept internal. They hold shared state or lifecycle and
 *    exposing them lets consumers reach into private plumbing. Use the
 *    domain classes (ESPRMNeoUser, ESPRMNeoGroup, ESPRMNeoNode, etc.) to
 *    reach any behaviour these internals implement.
 *
 * 2. Pure stateless utilities (JWT decoders, capability predicates,
 *    shadow-topic builders, ncfg-version helpers) — exposed via
 *    `utils/export.ts`. No state, no lifecycle; hiding them just forces
 *    consumers to reinvent them.
 *
 * If you want to re-export a stateful service here, ask first whether the
 * domain classes should grow a wrapper for it instead. Stateless utilities
 * go directly in `utils/export.ts`.
 */

/**
 * Subscription manager — accessed by consumers via `ESPRMNeoBase.subscriptionManager`.
 * The type must be public so that getter's return type is usable in app code.
 */
export { ESPRMNeoSubscriptionManager } from "./ESPRMNeoSubscriptionManager";

/**
 * MQTT transport contract that app-supplied MQTT adapters must satisfy.
 * Consumed by apps passing an adapter via `ESPRMNeoBaseConfig.mqttAdapter`.
 */
export type { MQTTTransport } from "./interfaces/MQTTTransport";

/**
 * Canonical event type emitted by every subscription channel when a node's
 * params change. Public so consumers can pattern-match on incoming updates.
 */
export { NODE_PARAMS_CHANGED_EVENT } from "./ESPRMNeoHelpers/transformShadowToNodeUpdate";

/**
 * Time-series fetcher entry points. Public so consumers can compose their
 * own custom pagination flows on top of {@link ESPRMNeoDeviceParam.getRawTSData}.
 */
export {
  fetchRawTSData,
  fetchLatestTSData,
  fetchAggregatedTSData,
} from "./ESPRMNeoHelpers/FetchTSData";
export type { FetchTSDataConfig } from "./ESPRMNeoHelpers/FetchTSData";
