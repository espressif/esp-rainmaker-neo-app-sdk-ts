/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../../src/ESPRMNeoGroup";

/**
 * Helper to test creating automation via group.createAutomation
 * @param group - The group instance
 * @param automationData - The automation data
 */
export async function createAutomationSuccessTest(
  group: ESPRMNeoGroup,
  automationData: any
) {
  const automation = await group.createAutomation(automationData);
  expect(automation.id).toBeDefined();
  expect(automation.groupId).toBe(group.groupId);
}

/**
 * Helper to test createAutomation error
 * @param group - The group instance
 * @param automationData - The automation data
 */
export async function createAutomationErrorTest(
  group: ESPRMNeoGroup,
  automationData: any
) {
  await expect(group.createAutomation(automationData)).rejects.toThrow();
}
