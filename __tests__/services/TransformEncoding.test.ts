/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../../src/services/ESPRMNeoHelpers/TransformEncoding";

describe("TransformEncoding", () => {
  describe("base64ToUint8Array", () => {
    it("should convert simple base64 string to Uint8Array", () => {
      const base64 = "SGVsbG8="; // "Hello" in base64
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(5);
      expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]); // "Hello" ASCII values
    });

    it("should convert empty base64 string to empty Uint8Array", () => {
      const base64 = "";
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });

    it("should convert base64 with padding to correct Uint8Array", () => {
      const base64 = "SGVsbG8gV29ybGQ="; // "Hello World" in base64
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(11);
      expect(Array.from(result)).toEqual([
        72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
      ]);
    });

    it("should convert base64 without padding to correct Uint8Array", () => {
      const base64 = "SGVsbG8gV29ybGQ"; // "Hello World" in base64 without padding
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(11);
      expect(Array.from(result)).toEqual([
        72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
      ]);
    });

    it("should convert base64 with special characters", () => {
      const base64 = "SGVsbG8hQCMkJV4mKigpXys9W117fXw7OiwuPD4/"; // "Hello!@#$%^&*()_+=[]{}|;:,.<>?" in base64
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      // Special characters may have different encoding lengths due to base64 padding
      expect(result.length).toBeGreaterThan(0);
      expect(Array.from(result)).toContain(72); // H
      expect(Array.from(result)).toContain(33); // !
      expect(Array.from(result)).toContain(64); // @
    });

    it("should convert base64 with numbers", () => {
      const base64 = "MTIzNDU2Nzg5MA=="; // "1234567890" in base64
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(10);
      expect(Array.from(result)).toEqual([
        49, 50, 51, 52, 53, 54, 55, 56, 57, 48,
      ]);
    });

    it("should convert base64 with mixed content", () => {
      const base64 = "SGVsbG8gMTIzICEhIQ=="; // "Hello 123 !!!" in base64
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(13);
      expect(Array.from(result)).toEqual([
        72, 101, 108, 108, 111, 32, 49, 50, 51, 32, 33, 33, 33,
      ]);
    });

    it("should handle base64 with unicode characters", () => {
      const base64 = "SGVsbG8g8J+RjSDigJQgV29ybGQh"; // "Hello 🌍 - World!" in base64
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      // Unicode characters may have different encoding lengths
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle base64 with emojis", () => {
      const base64 = "8J+RgPCfkYPwn5GA8J+RgfCfkYbwn5GD8J+RiA=="; // "😀😃😄😁😆😅😂🤣" in base64
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(28);
    });

    it("should handle very long base64 strings", () => {
      const longString = "a".repeat(1000);
      const base64 = btoa(longString);
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(1000);
      expect(Array.from(result)).toEqual(
        Array.from({ length: 1000 }, () => 97)
      ); // All 'a' characters
    });

    it("should handle base64 with binary data", () => {
      const binaryData = new Uint8Array([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ]);
      const base64 = btoa(
        String.fromCharCode.apply(null, Array.from(binaryData))
      );
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(16);
      expect(Array.from(result)).toEqual(Array.from(binaryData));
    });

    it("should handle base64 with null bytes", () => {
      const dataWithNulls = new Uint8Array([
        72, 101, 108, 108, 111, 0, 87, 111, 114, 108, 100, 0,
      ]);
      const base64 = btoa(
        String.fromCharCode.apply(null, Array.from(dataWithNulls))
      );
      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(12);
      expect(Array.from(result)).toEqual(Array.from(dataWithNulls));
    });
  });

  describe("uint8ArrayToBase64", () => {
    it("should convert simple Uint8Array to base64", () => {
      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result).toBe("SGVsbG8=");
    });

    it("should convert empty Uint8Array to empty base64", () => {
      const uint8Array = new Uint8Array([]);
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result).toBe("");
    });

    it("should convert Uint8Array with numbers to base64", () => {
      const uint8Array = new Uint8Array([
        49, 50, 51, 52, 53, 54, 55, 56, 57, 48,
      ]); // "1234567890"
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result).toBe("MTIzNDU2Nzg5MA==");
    });

    it("should convert Uint8Array with special characters to base64", () => {
      const uint8Array = new Uint8Array([
        72, 101, 108, 108, 111, 33, 64, 35, 36, 37, 94, 38, 42, 40, 41,
      ]); // "Hello!@#$%^&*()"
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result).toBe("SGVsbG8hQCMkJV4mKigp");
    });

    it("should convert Uint8Array with spaces to base64", () => {
      const uint8Array = new Uint8Array([
        72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
      ]); // "Hello World"
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result).toBe("SGVsbG8gV29ybGQ=");
    });

    it("should convert Uint8Array with newlines to base64", () => {
      const uint8Array = new Uint8Array([
        72, 101, 108, 108, 111, 10, 87, 111, 114, 108, 100,
      ]); // "Hello\nWorld"
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result).toBe("SGVsbG8KV29ybGQ=");
    });

    it("should convert Uint8Array with tabs to base64", () => {
      const uint8Array = new Uint8Array([
        72, 101, 108, 108, 111, 9, 87, 111, 114, 108, 100,
      ]); // "Hello\tWorld"
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result).toBe("SGVsbG8JV29ybGQ=");
    });

    it("should convert Uint8Array with unicode characters to base64", () => {
      const text = "Hello 🌍 - World!";
      const uint8Array = new TextEncoder().encode(text);
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should convert Uint8Array with emojis to base64", () => {
      const text = "😀😃😄😁😆😅😂🤣";
      const uint8Array = new TextEncoder().encode(text);
      const result = uint8ArrayToBase64(uint8Array);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should convert very long Uint8Array to base64", () => {
      const longArray = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) {
        longArray[i] = i % 256;
      }

      const result = uint8ArrayToBase64(longArray);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should convert Uint8Array with binary data to base64", () => {
      const binaryData = new Uint8Array([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ]);
      const result = uint8ArrayToBase64(binaryData);

      expect(typeof result).toBe("string");
      expect(result).toBe("AAECAwQFBgcICQoLDA0ODw==");
    });

    it("should convert Uint8Array with null bytes to base64", () => {
      const dataWithNulls = new Uint8Array([
        72, 101, 108, 108, 111, 0, 87, 111, 114, 108, 100, 0,
      ]);
      const result = uint8ArrayToBase64(dataWithNulls);

      expect(typeof result).toBe("string");
      expect(result).toBe("SGVsbG8AV29ybGQA");
    });
  });

  describe("round-trip conversion", () => {
    it("should maintain data integrity through base64 conversion cycle", () => {
      const originalData = new Uint8Array([
        72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
      ]);

      const base64 = uint8ArrayToBase64(originalData);
      const convertedBack = base64ToUint8Array(base64);

      expect(Array.from(convertedBack)).toEqual(Array.from(originalData));
    });

    it("should handle empty data round-trip", () => {
      const originalData = new Uint8Array([]);

      const base64 = uint8ArrayToBase64(originalData);
      const convertedBack = base64ToUint8Array(base64);

      expect(Array.from(convertedBack)).toEqual(Array.from(originalData));
    });

    it("should handle single byte round-trip", () => {
      const originalData = new Uint8Array([65]); // 'A'

      const base64 = uint8ArrayToBase64(originalData);
      const convertedBack = base64ToUint8Array(base64);

      expect(Array.from(convertedBack)).toEqual(Array.from(originalData));
    });

    it("should handle two bytes round-trip", () => {
      const originalData = new Uint8Array([65, 66]); // 'AB'

      const base64 = uint8ArrayToBase64(originalData);
      const convertedBack = base64ToUint8Array(base64);

      expect(Array.from(convertedBack)).toEqual(Array.from(originalData));
    });

    it("should handle three bytes round-trip", () => {
      const originalData = new Uint8Array([65, 66, 67]); // 'ABC'

      const base64 = uint8ArrayToBase64(originalData);
      const convertedBack = base64ToUint8Array(base64);

      expect(Array.from(convertedBack)).toEqual(Array.from(originalData));
    });

    it("should handle large data round-trip", () => {
      const originalData = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) {
        originalData[i] = i % 256;
      }

      const base64 = uint8ArrayToBase64(originalData);
      const convertedBack = base64ToUint8Array(base64);

      expect(Array.from(convertedBack)).toEqual(Array.from(originalData));
    });

    it("should handle unicode text round-trip", () => {
      const text = "Hello 🌍 World! 😀😃😄";
      const originalData = new TextEncoder().encode(text);

      const base64 = uint8ArrayToBase64(originalData);
      const convertedBack = base64ToUint8Array(base64);
      const decodedText = new TextDecoder().decode(convertedBack);

      expect(decodedText).toBe(text);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle base64 with invalid characters", () => {
      // Note: This test assumes the function handles invalid base64 gracefully
      // If it throws an error, that's also acceptable behavior
      expect(() => {
        base64ToUint8Array("invalid-base64!@#$%");
      }).toThrow();
    });

    it("should handle base64 with mixed valid and invalid characters", () => {
      expect(() => {
        base64ToUint8Array("SGVsbG8=invalid");
      }).toThrow();
    });

    it("should handle very long base64 strings", () => {
      const longString = "a".repeat(10000);
      const base64 = btoa(longString);

      const result = base64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(10000);
    });

    it("should handle concurrent conversions", async () => {
      const testData = new Uint8Array([72, 101, 108, 108, 111]);

      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve().then(() => {
          const base64 = uint8ArrayToBase64(testData);
          const converted = base64ToUint8Array(base64);
          return Array.from(converted);
        })
      );

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toEqual([72, 101, 108, 108, 111]);
      });
    });
  });

  // Wall-clock assertions removed 2026-07-28 (same sweep as GenerateUUID):
  // shared CI runners are arbitrarily slow, and the offline gates are
  // retry-free by design, so timing bounds only produce flakes. The correctness
  // content — large payloads round-trip losslessly — is kept.
  describe("large payloads", () => {
    it("should round-trip large data losslessly", () => {
      const largeData = new Uint8Array(100000);
      for (let i = 0; i < 100000; i++) {
        largeData[i] = i % 256;
      }

      const base64 = uint8ArrayToBase64(largeData);
      const convertedBack = base64ToUint8Array(base64);

      expect(convertedBack.length).toBe(100000);
      expect(convertedBack).toEqual(largeData);
    });
  });
});
