/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../../src/ESPRMNeoGroup";

/**
 * Helper to test deleting automation via group.getAutomation then automation.delete
 */
export async function deleteAutomationSuccessTest(
  group: ESPRMNeoGroup,
  automationId: string
) {
  const automation = await group.getAutomation(automationId);
  await automation.delete();
}

/**
 * Helper to test delete automation error
 */
export async function deleteAutomationErrorTest(
  group: ESPRMNeoGroup,
  automationId: string
) {
  const automation = await group.getAutomation(automationId);
  await expect(automation.delete()).rejects.toThrow();
}
