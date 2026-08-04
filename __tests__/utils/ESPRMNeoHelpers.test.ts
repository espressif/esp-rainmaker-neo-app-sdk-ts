/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateUUIDv4 } from "../../src/services/ESPRMNeoHelpers/GenerateUUID";
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../../src/services/ESPRMNeoHelpers/TransformEncoding";
import { getCurrentTimestamp } from "../../src/services/ESPRMNeoHelpers/GetCurrentTimestamp";

describe("ESPRMNeoHelpers Tests", () => {
  describe("GenerateUUID", () => {
    it("should generate a valid UUID", () => {
      const uuid = generateUUIDv4();

      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe("string");
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should generate unique UUIDs", () => {
      const uuid1 = generateUUIDv4();
      const uuid2 = generateUUIDv4();

      expect(uuid1).not.toBe(uuid2);
    });
  });

  // NodeMappingHelper is covered for real (HTTP contract) in
  // __tests__/services/helpers/NodeMappingHelper.test.ts.

  describe("TransformEncoding", () => {
    it("should convert base64 to Uint8Array", () => {
      const base64 = "SGVsbG8gV29ybGQ=";
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should convert Uint8Array to base64", () => {
      const array = new Uint8Array([72, 101, 108, 108, 111]);
      const result = uint8ArrayToBase64(array);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle round-trip conversion", () => {
      const original = new Uint8Array([
        72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
      ]);
      const base64 = uint8ArrayToBase64(original);
      const converted = base64ToUint8Array(base64);

      expect(converted).toEqual(original);
    });
  });

  describe("GetCurrentTimestamp", () => {
    it("should return current timestamp in seconds", () => {
      const timestamp = getCurrentTimestamp();

      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe("number");
      expect(timestamp).toBeGreaterThan(0);
    });

    it("should return timestamp close to current time", () => {
      const timestamp = getCurrentTimestamp();
      const currentTime = Math.floor(Date.now() / 1000);

      expect(Math.abs(timestamp - currentTime)).toBeLessThan(5); // Within 5 seconds
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid base64 gracefully", () => {
      expect(() => {
        base64ToUint8Array("invalid-base64!");
      }).toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty Uint8Array", () => {
      const emptyArray = new Uint8Array(0);
      const base64 = uint8ArrayToBase64(emptyArray);
      const converted = base64ToUint8Array(base64);

      expect(converted).toEqual(emptyArray);
    });
  });
});
