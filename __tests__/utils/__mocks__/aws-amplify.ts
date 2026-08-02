/// <reference types="jest" />

// Mock for aws-amplify
export const Amplify = {
  configure: jest.fn(),
  getConfig: jest.fn(() => ({
    Auth: {
      region: "us-east-1",
      userPoolId: "us-east-1_2jBAsMucj",
      userPoolWebClientId: "7r6oaib3lq361b7oaigaqj36kb",
      identityPoolId: "us-east-1:933ebf26-5f91-46fa-898a-a9fc0ae128c5",
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
