/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../../src/ESPRMNeoGroup";

/**
 * Helper to test getting all automations via group.getAutomations
 */
export async function getAutomationsSuccessTest(group: ESPRMNeoGroup) {
  const result = await group.getAutomations();
  expect(Array.isArray(result)).toBe(true);
  if (result.length > 0) {
    expect(result[0].id).toBeDefined();
    expect(result[0].name).toBeDefined();
  }
}

/**
 * Helper to test getAutomations error
 */
export async function getAutomationsErrorTest(group: ESPRMNeoGroup) {
  await expect(group.getAutomations()).rejects.toThrow();
}
