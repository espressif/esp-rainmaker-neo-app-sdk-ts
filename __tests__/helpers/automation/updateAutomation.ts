/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../../src/ESPRMNeoGroup";

/**
 * Helper to test updating automation via group.getAutomation then automation.update
 */
export async function updateAutomationSuccessTest(
  group: ESPRMNeoGroup,
  automationId: string,
  automationData: any
) {
  const automation = await group.getAutomation(automationId);
  await automation.update(automationData);
  expect(automation.id).toBe(automationId);
  expect(automation.groupId).toBe(group.groupId);
}

/**
 * Helper to test update automation error
 */
export async function updateAutomationErrorTest(
  group: ESPRMNeoGroup,
  automationId: string,
  automationData: any
) {
  const automation = await group.getAutomation(automationId);
  await expect(automation.update(automationData)).rejects.toThrow();
}
