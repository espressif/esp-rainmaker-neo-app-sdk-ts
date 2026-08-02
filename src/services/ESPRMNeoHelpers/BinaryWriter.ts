/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export class BinaryWriter {
  private buffer: number[] = [];

  write(bytes: Uint8Array): void {
    this.buffer.push(...bytes);
  }

  bytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
