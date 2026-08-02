/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoNode } from "../../ESPRMNeoNode";
import { ESPTransportManager } from "../ESPTransport/ESPTransportManager";
import {
  ESPTransportConfig,
  ESPTransportInterface,
  ESPTransportMode,
} from "../../types/transport";
import {
  APICallValidationErrorCodes,
  ESPServiceParamType,
  ESPServiceType,
} from "../../utils/constants";
import {
  coerceToFiniteNumber,
  coerceToNonEmptyString,
} from "../../utils/coerce";
import { ESPAPICallValidationError } from "../../utils/error/ESPAPICallValidationError";

interface LocalControlCreds {
  securityType?: number;
  pop?: string;
  username?: string;
}

/**
 * Resolves the param ID for a given param type within a service's param list.
 * Returns `undefined` when no param with that type is registered.
 */
function resolveParamId(
  serviceParams: Array<{ type: string; id: string }>,
  paramType: string
): string | undefined {
  return serviceParams.find((p) => p.type === paramType)?.id;
}

/**
 * Reads the local-control credentials directly from the node's
 * local-control service param values.
 */
function readLocalControlCreds(node: ESPRMNeoNode): LocalControlCreds {
  const service = node.services.find(
    (s) => s.type === ESPServiceType.LOCAL_CONTROL
  );
  if (!service) return {};

  const readCred = (paramType: string): any => {
    const paramId = resolveParamId(service.params, paramType);
    return paramId !== undefined
      ? service.params.find((p) => p.id === paramId)?.value
      : undefined;
  };

  const securityType = coerceToFiniteNumber(
    readCred(ESPServiceParamType.LOCAL_CONTROL.TYPE)
  );
  const pop = coerceToNonEmptyString(
    readCred(ESPServiceParamType.LOCAL_CONTROL.POP)
  );
  const username = coerceToNonEmptyString(
    readCred(ESPServiceParamType.LOCAL_CONTROL.USERNAME)
  );

  return {
    ...(securityType !== undefined && { securityType }),
    ...(pop !== undefined && { pop }),
    ...(username !== undefined && { username }),
  };
}

/**
 * Builds the transport config for the `local` control transport: validates that
 * a `baseUrl` is known and enriches the metadata with the node's on-demand
 * credentials — `securityType` for all schemes, `pop` for sec1/sec2, and
 * additionally `username` for sec2. Returns a new config (does not mutate the
 * node's stored `availableTransports`).
 *
 * @throws {ESPAPICallValidationError} `MISSING_BASE_URL` when no baseUrl is set;
 *   the caller treats this like any transport failure and tries the next mode.
 */
function buildLocalControlConfig(
  node: ESPRMNeoNode,
  config: ESPTransportConfig
): ESPTransportConfig {
  if (!config.metadata?.baseUrl) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.MISSING_BASE_URL
    );
  }
  const creds = readLocalControlCreds(node);
  const metadata: Record<string, any> = {
    ...config.metadata,
    securityType: creds.securityType ?? 0,
  };
  if (creds.securityType === 1 || creds.securityType === 2) {
    metadata.pop = creds.pop;
  }
  // sec2 additionally authenticates with a username (SRP6a salt/verifier).
  if (creds.securityType === 2) {
    metadata.username = creds.username;
  }
  return { ...config, metadata };
}

/**
 * Drives a transport operation over the best available transport for a node.
 *
 * Iterates the node's {@link ESPRMNeoNode.transportOrder} and, for each mode
 * present in {@link ESPRMNeoNode.availableTransports}:
 *  1. For the `local` mode, validates a `baseUrl` is known and enriches the
 *     transport config metadata with the node's `securityType`/`pop`/`username`.
 *  2. Uses a registered custom transport manager for that mode if one exists;
 *     otherwise constructs the built-in {@link ESPTransportManager}.
 *  3. Runs the supplied `operation` against the transport. The first success
 *     wins; failures fall through to the next mode in the order.
 *
 * Must be invoked bound to a node, e.g.
 * `delegatedTransportHandler.call(node, (m) => m.setParam(payload, node))`.
 *
 * @typeParam T - Result type of the transport operation.
 * @param operation - Callback receiving the selected transport.
 * @returns The operation result from the first successful transport.
 * @throws {ESPAPICallValidationError} `NODE_UNREACHABLE` if no transport is
 *   configured/available, or the last transport error if all attempts fail.
 */
const delegatedTransportHandler = async function <T>(
  this: ESPRMNeoNode,
  operation: (manager: ESPTransportInterface) => Promise<T>
): Promise<T> {
  const order = this.transportOrder?.length
    ? this.transportOrder
    : [ESPTransportMode.local, ESPTransportMode.mqtt];
  const available = this.availableTransports ?? {};

  if (order.length === 0 || Object.keys(available).length === 0) {
    throw new ESPAPICallValidationError(
      APICallValidationErrorCodes.NODE_UNREACHABLE
    );
  }

  let errorInstance: unknown;
  let success = false;
  let result: T;

  for (const transportMode of order) {
    const config: ESPTransportConfig =
      available[transportMode as keyof typeof available];
    if (!config) continue;

    const customManager = this.customTransportManagers?.[transportMode];
    try {
      // The local transport needs connection metadata (baseUrl from mDNS;
      // securityType/pop read on-demand from the node) before it can be used.
      const transportConfig =
        transportMode === ESPTransportMode.local
          ? buildLocalControlConfig(this, config)
          : config;
      const manager: ESPTransportInterface =
        customManager ?? new ESPTransportManager(transportConfig);
      result = await operation(manager);
      success = true;
      break;
    } catch (error: unknown) {
      errorInstance = error;
    }
  }

  if (!success) {
    throw (
      errorInstance ??
      new ESPAPICallValidationError(
        APICallValidationErrorCodes.NODE_UNREACHABLE
      )
    );
  }

  return result!;
};

export { delegatedTransportHandler };
