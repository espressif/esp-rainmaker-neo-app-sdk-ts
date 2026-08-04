/// <reference types="jest" />

/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export const fetch = jest.fn(() => Promise.resolve({ isConnected: true }));
export const addEventListener = jest.fn();
