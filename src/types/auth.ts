/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ESPRMNeoUserInfo {
  username: string;
  userAttributes: Record<string, string | undefined>;
  /** RainMaker `user_id` from `GET /v1/users/{userId}`. */
  userId?: string;
}

/** Response shape for GET /v1/users/{userId} (snake_case from backend). */
export interface GetUserApiResponse {
  user_id: string;
  email?: string;
  phone_number?: string;
}

export interface ESPRMNeoAuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

/** Request body for POST /v1/user/auth/token/refresh. */
export interface TokenRefreshRequest {
  refresh_token: string;
}

/** Standard shape of the token/refresh API response (snake_case from backend). */
export interface TokenRefreshApiResponse {
  access_token: string;
  id_token: string;
}

/** Request body for POST /v1/user/auth/token (Login). */
export interface SigninRequest {
  username: string;
  password: string;
}

/** Response shape for POST /v1/user/auth/token (snake_case from backend). */
export interface SigninApiResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
}

/** Request body for POST /v1/user/auth/signup. */
export interface SignupRequest {
  password: string;
  email?: string;
  phone_number?: string;
}

/** Response shape for POST /v1/user/auth/signup (snake_case from backend). */
export interface SignupApiResponse {
  message?: string;
}

/** Request body for POST /v1/user/auth/signup/verify. */
export interface VerifySignupRequest {
  code: string;
  email?: string;
  phone_number?: string;
}

/** Response shape for POST /v1/user/auth/signup/verify (snake_case from backend). */
export interface VerifySignupApiResponse {
  message?: string;
}

/** Request body for POST /v1/user/auth/password-recovery. */
export interface ForgotPasswordRequest {
  username: string;
}

/** Response shape for POST /v1/user/auth/password-recovery (snake_case from backend). */
export interface ForgotPasswordApiResponse {
  message?: string;
}

/** Request body for POST /v1/user/auth/password-recovery/confirmation. */
export interface PasswordRecoveryConfirmationRequest {
  username: string;
  code: string;
  new_password: string;
}

/** Response shape for POST /v1/user/auth/password-recovery/confirmation. */
export interface PasswordRecoveryConfirmationApiResponse {
  message?: string;
}

/** Request body for POST /v1/user/auth/password (Change Password). */
export interface ChangePasswordRequest {
  /** Access token (required by backend for Cognito ChangePassword API). */
  access_token: string;
  old_password: string;
  new_password: string;
}

/** Response shape for POST /v1/user/auth/password. */
export interface ChangePasswordApiResponse {
  message?: string;
}

export interface ESPRMNeoAuthConfig {
  awsRegion: string;
}
