/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems \(Shanghai\) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mock data and utilities for trigger tests
 */

export const MOCK_GROUP_ID = "test-group-id";
export const MOCK_NODE_ID = "test-node-id";
export const MOCK_AUTOMATION_ID = "test-automation-id";
export const MOCK_TRIGGER_ID = `${MOCK_NODE_ID}~${MOCK_AUTOMATION_ID}~001`;

export const MOCK_TRIGGER_DATA = {
  triggers: [
    {
      id: MOCK_TRIGGER_ID,
      path: "Temperature Sensor.Temperature",
      operator: "gt",
      value: 25,
    },
  ],
};

export const MOCK_GET_TRIGGER_RESPONSE = {
  triggers: [
    {
      id: MOCK_TRIGGER_ID,
      path: "Temperature Sensor.Temperature",
      operator: "gt",
      value: 25,
    },
  ],
};

export const MOCK_SET_TRIGGER_RESPONSE = {
};
