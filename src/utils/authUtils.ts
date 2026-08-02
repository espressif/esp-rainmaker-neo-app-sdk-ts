/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns true when `username` looks like an E.164 phone number (leading `+`).
 * Used by sign-up / confirm flows to choose `phone_number` vs `email`.
 */
export function isPhoneUsername(username: string): boolean {
  return username.startsWith("+");
}

/**
 * Maps a username to the signup/verify identity fields expected by the User API.
 *
 * Phone usernames (leading `+`) become `phone_number`; everything else becomes `email`.
 */
export function signupIdentityFromUsername(username: string): {
  email?: string;
  phone_number?: string;
} {
  return isPhoneUsername(username)
    ? { phone_number: username }
    : { email: username };
}
