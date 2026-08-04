/// <reference types="jest" />

/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Mock for aws-amplify
export const Amplify = {
  configure: jest.fn(),
  getConfig: jest.fn(() => ({
    Auth: {
      region: "us-east-1",
      userPoolId: "us-east-1_testpool",
      userPoolWebClientId: "test_client_id_123",
      identityPoolId: "us-east-1:00000000-0000-0000-0000-000000000000",
    },
  })),
};

export const Auth = {
  currentCredentials: jest.fn(() =>
    Promise.resolve({
      accessKeyId: "mock-access-key",
      secretAccessKey: "mock-secret-key",
      sessionToken: "mock-session-token",
      expiration: new Date(Date.now() + 3600000),
      identityId: "mock-identity-id",
      authenticated: true,
    })
  ),
  federatedSignIn: jest.fn(() => Promise.resolve(undefined)),
  currentAuthenticatedUser: jest.fn(() =>
    Promise.resolve({
      username: "test-user",
      attributes: {
        email: "test@example.com",
      },
    })
  ),
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  forgotPassword: jest.fn(),
  forgotPasswordSubmit: jest.fn(),
  changePassword: jest.fn(),
};
