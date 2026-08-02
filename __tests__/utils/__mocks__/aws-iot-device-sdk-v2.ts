/// <reference types="jest" />

export const mqtt = {
  connect: jest.fn(),
};

export const auth = {
  aws_credentials_provider: {
    new: jest.fn(),
  },
};
