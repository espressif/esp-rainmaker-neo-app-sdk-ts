/// <reference types="jest" />

export const connect = jest.fn(() => ({
  on: jest.fn(),
  subscribe: jest.fn(),
  publish: jest.fn(),
  end: jest.fn(),
  connected: true,
}));
