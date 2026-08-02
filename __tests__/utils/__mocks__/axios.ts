/// <reference types="jest" />

const mockInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

export const create = jest.fn(() => mockInstance);
export const get = jest.fn();
export const post = jest.fn();
export const put = jest.fn();
const deleteFn = jest.fn();
export { deleteFn as delete };
