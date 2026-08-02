/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mock data and utilities for automation tests
 */

export const MOCK_GROUP_ID = "test-group-id";
export const MOCK_AUTOMATION_ID = "test-automation-id";
export const MOCK_NODE_ID = "test-node-id";

export const MOCK_EMPTY_AUTOMATION_RESPONSE = {
  automation_id: MOCK_AUTOMATION_ID,
  group_id: MOCK_GROUP_ID,
};

export const MOCK_AUTOMATION_DATA = {
  name: "Test Automation",
  conditions: { and: ["trigger1", "trigger2"] },
  actions: {
    targets: [
      {
        node: MOCK_NODE_ID,
        path: "Light.Power",
        value: true,
      },
    ],
  },
};

export const MOCK_AUTOMATION_RESPONSE = {
  automation_id: MOCK_AUTOMATION_ID,
  group_id: MOCK_GROUP_ID,
};

export const MOCK_GET_AUTOMATION_RESPONSE = {
  id: MOCK_AUTOMATION_ID,
  status: "enabled",
  name: "Test Automation",
  conditions: { and: ["trigger1"] },
  actions: {
    targets: [
      {
        node: MOCK_NODE_ID,
        path: "Light.Power",
        value: true,
      },
    ],
  },
};

export const MOCK_GET_AUTOMATIONS_RESPONSE = {
  automations: [
    {
      id: MOCK_AUTOMATION_ID,
      status: "enabled",
      name: "Automation 1",
      conditions: { and: ["trigger1"] },
      actions: { targets: [] },
    },
    {
      id: "auto-456",
      status: "disabled",
      name: "Automation 2",
      conditions: { and: ["trigger2"] },
      actions: { targets: [] },
    },
  ],
};

export const MOCK_DELETE_AUTOMATION_RESPONSE = {
  success: true,
};

export const MOCK_DELETE_AUTOMATION_ERROR = {
  success: false,
  error: "Automation deletion failed",
};
