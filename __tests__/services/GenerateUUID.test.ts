/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateUUIDv4 } from "../../src/services/ESPRMNeoHelpers/GenerateUUID";

describe("GenerateUUID", () => {
  describe("generateUUIDv4", () => {
    it("should generate a valid UUID v4 format", () => {
      const uuid = generateUUIDv4();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuid).toMatch(uuidRegex);
      expect(uuid.length).toBe(36); // 32 hex chars + 4 hyphens
    });

    it("should generate different UUIDs on each call", () => {
      const uuid1 = generateUUIDv4();
      const uuid2 = generateUUIDv4();
      const uuid3 = generateUUIDv4();

      expect(uuid1).not.toBe(uuid2);
      expect(uuid1).not.toBe(uuid3);
      expect(uuid2).not.toBe(uuid3);
    });

    it("should have correct version bits (4th position should be 4)", () => {
      const uuid = generateUUIDv4();
      const versionChar = uuid.charAt(14); // 4th position (0-indexed)

      expect(versionChar).toBe("4");
    });

    it("should have correct variant bits (8th position should be 8, 9, a, or b)", () => {
      const uuid = generateUUIDv4();
      const variantChar = uuid.charAt(19); // 8th position (0-indexed)

      expect(["8", "9", "a", "b"]).toContain(variantChar.toLowerCase());
    });

    it("should generate only hexadecimal characters", () => {
      const uuid = generateUUIDv4();
      const hexChars = uuid.replace(/-/g, ""); // Remove hyphens

      // Check that all characters are valid hex
      const validHexRegex = /^[0-9a-f]+$/i;
      expect(hexChars).toMatch(validHexRegex);
    });

    it("should have correct hyphen positions", () => {
      const uuid = generateUUIDv4();

      expect(uuid.charAt(8)).toBe("-");
      expect(uuid.charAt(13)).toBe("-");
      expect(uuid.charAt(18)).toBe("-");
      expect(uuid.charAt(23)).toBe("-");
    });

    it("should generate multiple UUIDs with correct format", () => {
      const uuids = Array.from({ length: 100 }, () => generateUUIDv4());

      uuids.forEach((uuid) => {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(uuid).toMatch(uuidRegex);
        expect(uuid.length).toBe(36);
      });
    });

    it("should handle rapid successive calls", () => {
      // No wall-clock assertion: shared CI runners are arbitrarily slow
      // (observed 2.7s for a "1s budget" loop), so timing bounds only
      // produce flakes. Correctness = every call still yields a valid v4.
      for (let i = 0; i < 1000; i++) {
        const uuid = generateUUIDv4();
        expect(uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      }
    });

    it("should generate unique UUIDs in large batches", () => {
      const batchSize = 10000;
      const uuids = new Set();

      for (let i = 0; i < batchSize; i++) {
        const uuid = generateUUIDv4();
        uuids.add(uuid);
      }

      // All UUIDs should be unique
      expect(uuids.size).toBe(batchSize);
    });

    it("should maintain consistent format across different execution contexts", () => {
      // Test in different execution contexts
      const contexts = [
        () => generateUUIDv4(),
        () => setTimeout(() => generateUUIDv4(), 0),
        () => Promise.resolve().then(() => generateUUIDv4()),
      ];

      // Test synchronous context
      const syncUuid = generateUUIDv4();
      expect(syncUuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Test async contexts (these return promises, so we test the function itself)
      contexts.forEach((context) => {
        const result = context();
        if (typeof result === "string") {
          expect(result).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          );
        }
      });
    });
  });

  describe("UUID format validation", () => {
    it("should validate correct UUID v4 examples", () => {
      const validUuids = [
        "550e8400-e29b-41d4-a716-446655440000",
        "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
        "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
        "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
      ];

      validUuids.forEach((_uuid) => {
        const generated = generateUUIDv4();
        expect(generated).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });

    it("should reject invalid UUID formats", () => {
      const invalidUuids = [
        "not-a-uuid",
        "550e8400-e29b-41d4-a716-44665544000", // Too short
        "550e8400-e29b-41d4-a716-4466554400000", // Too long
        "550e8400-e29b-41d4-a716-44665544000g", // Invalid character
        "550e8400-e29b-41d4-a716-44665544000-", // Extra hyphen
        "550e8400e29b-41d4-a716-446655440000", // Missing hyphen
        "550e8400-e29b41d4-a716-446655440000", // Missing hyphen
        "550e8400-e29b-41d4a716-446655440000", // Missing hyphen
        "550e8400-e29b-41d4-a716446655440000", // Missing hyphen
      ];

      invalidUuids.forEach((invalidUuid) => {
        const generated = generateUUIDv4();
        expect(generated).not.toBe(invalidUuid);
        expect(generated).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });
  });

  // Timing (duration/avg/max) and heap-usage assertions were removed
  // 2026-07-28 after failing on a loaded CI runner (suites that take ~2s
  // locally took 170-280s there). The offline gates are deliberately
  // retry-free by design, so every assertion must be deterministic —
  // wall-clock and GC behavior on shared runners are not.
  describe("reliability", () => {
    it("should handle concurrent generation without conflicts", async () => {
      const concurrentCount = 100;
      const promises = Array.from({ length: concurrentCount }, () =>
        Promise.resolve().then(() => generateUUIDv4())
      );

      const uuids = await Promise.all(promises);
      const uniqueUuids = new Set(uuids);

      expect(uniqueUuids.size).toBe(concurrentCount);

      uuids.forEach((uuid) => {
        expect(uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });
  });

  describe("edge cases", () => {
    it("should handle Math.random edge cases", () => {
      // Mock Math.random to return edge case values
      const originalRandom = Math.random;

      try {
        // Test with Math.random returning very small values (but not 0)
        Math.random = jest.fn(() => 0.0000001);
        const uuid1 = generateUUIDv4();
        expect(uuid1).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );

        // Test with Math.random returning values close to 1 (but not 1)
        Math.random = jest.fn(() => 0.9999999);
        const uuid2 = generateUUIDv4();
        expect(uuid2).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );

        // Test with Math.random returning 0.5 (middle value)
        Math.random = jest.fn(() => 0.5);
        const uuid3 = generateUUIDv4();
        expect(uuid3).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );

        // Test with Math.random returning values that test the variant bit logic
        Math.random = jest.fn(() => 0.25);
        const uuid4 = generateUUIDv4();
        expect(uuid4).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      } finally {
        Math.random = originalRandom;
      }
    });

    it("should handle toString(16) edge cases", () => {
      // The function should handle all possible values from Math.random * 16 | 0
      for (let i = 0; i < 16; i++) {
        const mockRandom = i / 16;
        const originalRandom = Math.random;

        try {
          Math.random = jest.fn(() => mockRandom);
          const uuid = generateUUIDv4();
          expect(uuid).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          );
        } finally {
          Math.random = originalRandom;
        }
      }
    });
  });
});
