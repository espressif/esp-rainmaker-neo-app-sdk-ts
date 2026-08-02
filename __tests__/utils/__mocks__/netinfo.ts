/// <reference types="jest" />

export const fetch = jest.fn(() => Promise.resolve({ isConnected: true }));
export const addEventListener = jest.fn();
