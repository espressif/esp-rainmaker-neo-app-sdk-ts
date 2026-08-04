/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export const v1 = jest.fn(() => "mock-uuid-v1");
export const v4 = jest.fn(() => "mock-uuid-v4");
export const v5 = jest.fn(() => "mock-uuid-v5");

export default {
  v1,
  v4,
  v5,
};
