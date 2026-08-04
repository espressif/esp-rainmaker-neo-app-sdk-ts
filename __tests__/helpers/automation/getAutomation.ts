/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../../src/ESPRMNeoGroup";

/**
 * Helper to test getting automation via group.getAutomation
 */
export async function getAutomationSuccessTest(
  group: ESPRMNeoGroup,
  automationId: string
) {
  const result = await group.getAutomation(automationId);
  expect(result).toBeDefined();
  expect(result.id).toBe(automationId);
  expect(result.name).toBeDefined();
}

/**
 * Helper to test getAutomation error
 */
export async function getAutomationErrorTest(
  group: ESPRMNeoGroup,
  automationId: string
) {
  await expect(group.getAutomation(automationId)).rejects.toThrow();
}
