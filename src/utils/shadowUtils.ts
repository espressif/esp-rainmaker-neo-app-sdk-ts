/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "./logger";

const logger = new Logger("ShadowUtils");

/**
 * Constructs a shadow name based on group ID and subgroups
 * @param groupId The group ID
 * @param subgroups Array of subgroup IDs
 * @returns The constructed shadow name
 */
export function constructShadowName(
  groupId: string,
  subgroups: string[] = []
): string {
  let shadowName = `params-${groupId}`;
  if (subgroups.length > 0) {
    const sortedSubgroups = [...subgroups].sort();
    shadowName += `-${sortedSubgroups.join("-")}`;
  }
  return shadowName;
}

/**
 * Constructs a shadow topic for a device
 * @param nodeId The node ID
 * @param groupId The group ID
 * @param subgroups Array of subgroup IDs
 * @returns The constructed shadow topic
 */
export function constructShadowTopic(
  nodeId: string,
  groupId: string,
  subgroups: string[]
): string {
  const shadowName = constructShadowName(groupId, subgroups);
  return `$aws/things/${nodeId}/shadow/name/${shadowName}`;
}

/**
 * Constructs a device parameters topic
 * @param nodeId The node ID
 * @param groupId The group ID
 * @param subgroups Array of subgroup IDs
 * @returns The constructed parameters topic
 */
export function constructDeviceParamsTopic(
  nodeId: string,
  groupId: string,
  subgroups: string[]
): string {
  const shadowName = constructShadowName(groupId, subgroups);
  return `rainmaker/nodes/${nodeId}/user/${shadowName}/params`;
}

/**
 * Generates a digest for parameters to detect changes
 * @param params The parameters object
 * @returns A digest string representing the parameters
 */
export function generateParamsDigest(params: Record<string, any>): string {
  try {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = params[key];
          return result;
        },
        {} as Record<string, any>
      );

    return JSON.stringify(sortedParams);
  } catch (error) {
    logger.error("Error generating params digest:", error);
    return "";
  }
}
