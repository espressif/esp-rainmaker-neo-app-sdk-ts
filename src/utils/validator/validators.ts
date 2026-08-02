/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks if a string is not empty.
 * @param value - The string to check.
 * @returns True if the string is not empty, false otherwise.
 */
export const isNonEmptyString = (value: any): boolean => {
  return typeof value === "string" && value.trim().length > 0;
};

/**
 * Validates if a given string is a valid URL.
 * @param url - The URL string to validate.
 * @returns True if the URL is valid, false otherwise.
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks if a value is a valid object (not null and type object).
 * @param value - The value to check.
 * @returns True if the value is a valid object, false otherwise.
 */
export const isValidObject = (value: any): boolean => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};
