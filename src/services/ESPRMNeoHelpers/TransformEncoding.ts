/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts a base64 string to a Uint8Array.
 * @param b64 The base64 string to convert
 * @returns A Uint8Array containing the decoded bytes
 * @throws {Error} If the input is not a valid base64 string
 */
export function base64ToUint8Array(b64: string): Uint8Array {
  // Validate base64 string format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(b64)) {
    throw new Error(`Invalid base64 string: contains invalid characters`);
  }

  try {
    if ((globalThis as any).Buffer) {
      const buf = (globalThis as any).Buffer.from(b64, "base64");
      // Buffer.from doesn't throw for invalid base64, so we need to validate by encoding back
      const reencoded = buf.toString("base64");
      // Remove padding for comparison
      const normalizedInput = b64.replace(/=+$/, "");
      const normalizedOutput = reencoded.replace(/=+$/, "");
      if (normalizedInput !== normalizedOutput) {
        throw new Error(`Invalid base64 string: decoding failed`);
      }
      return Uint8Array.from(buf);
    } else {
      const bin = globalThis.atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; ++i) {
        arr[i] = bin.charCodeAt(i);
      }
      return arr;
    }
  } catch (error) {
    throw new Error(
      `Invalid base64 string: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Converts a Uint8Array to a base64 string.
 * @param arr The Uint8Array to convert
 * @returns A base64-encoded string
 */
export function uint8ArrayToBase64(arr: Uint8Array): string {
  if ((globalThis as any).Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin: string[] = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}
