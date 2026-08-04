/// <reference types="jest" />

/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export const mqtt = {
  connect: jest.fn(),
};

export const auth = {
  aws_credentials_provider: {
    new: jest.fn(),
  },
};
