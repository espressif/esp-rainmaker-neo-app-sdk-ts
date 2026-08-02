/// <reference types="jest" />

/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

declare namespace jest {
  interface Matchers<R> {
    toBeInstanceOf(expected: any): R;
    toBeNull(): R;
    toBeUndefined(): R;
    toBeDefined(): R;
    toBeTruthy(): R;
    toBeFalsy(): R;
    toContain(expected: any): R;
    toEqual(expected: any): R;
    toHaveLength(expected: number): R;
    toHaveProperty(expected: string, value?: any): R;
    toThrow(expected?: string | Error | RegExp): R;
    toHaveBeenCalledWith(...expected: any[]): R;
  }
}
