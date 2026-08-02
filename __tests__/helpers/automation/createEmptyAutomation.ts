/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup } from "../../../src/ESPRMNeoGroup";

const emptyAutomationPayload = (name: string) => ({
  name,
  conditions: { and: [] as any[] },
  actions: { targets: [] as any[] },
});

/**
 * Helper to test creating empty automation via group.createAutomation.
 * @param group - The group instance
 * @param name - The automation name
 */
export async function createEmptyAutomationSuccessTest(
  group: ESPRMNeoGroup,
  name: string
) {
  const automation = await group.createAutomation(emptyAutomationPayload(name));
  expect(automation.id).toBeDefined();
  expect(automation.groupId).toBe(group.groupId);
}

/**
 * Helper to test createAutomation error.
 * @param group - The group instance
 * @param name - The automation name
 */
export async function createEmptyAutomationErrorTest(
  group: ESPRMNeoGroup,
  name: string
) {
  await expect(
    group.createAutomation(emptyAutomationPayload(name))
  ).rejects.toThrow();
}
