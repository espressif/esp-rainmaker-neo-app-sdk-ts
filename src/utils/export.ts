/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export * from "./awsShadowTopics";
export * from "./coerce";
export * from "./awsSigv4Utils";
export * from "./awsUtils";
export * from "./constants";
export * from "./logger";
export * from "./mapLimit";
export * from "./eventEmitter";
export * from "./mqtt";
export * from "./shadowUtils";
export * from "./waitForNodeOnline";
export * from "./nodeNcfgVersionHandler";
export * from "./nodeUtils";
export * from "./groupUtils";
export * from "./scheduleUtils";
export * from "./triggerUtils";
export * from "./tsDataUtils";
export * from "./userUtils";

export { ESPBaseError } from "./error/ESPBaseError";
export * from "./error/Error";
export * from "./validator/validators";

// Pure stateless utilities — safe as public API (no lifecycle, no shared state).
// See services/export.ts for the internal-vs-public policy for helpers.
export { decodeToken } from "../services/ESPRMNeoHelpers/DecodeToken";
// NOTE: ChallengeResponseHelper is intentionally NOT re-exported here. It
// pulls proto/*.ts modules that `extends google-protobuf.Message`, and that
// runtime dep is only available inside this SDK's own bundle — pulling it
// into a downstream Metro/RN bundle crashes with
// "Super expression must either be null or a function" during module init.
// Consumers that need `checkChallengeResponseCapability` should inline the
// small predicate on their side (see esp-nova-home-app's provisioning
// transformer for an example).
