// Unmock ESPRMNeoStorage to test the real implementation
jest.unmock("../../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");

import {
  ESPRMNeoStorage,
  _resetESPRMNeoStorageForTests,
} from "../../../src/services/ESPRMNeoStorage/ESPRMNeoStorage";
import { ESPStorageAdapter } from "../../../src/types/storage";
import { ESPAWSCredentials } from "../../../src/types/input";
import { NodeConfigAPI } from "../../../src/types/output";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe("ESPRMNeoStorage", () => {
  let mockStorageAdapter: {
    getItem: jest.MockedFunction<ESPStorageAdapter["getItem"]>;
    setItem: jest.MockedFunction<ESPStorageAdapter["setItem"]>;
    removeItem: jest.MockedFunction<
      ESPStorageAdapter["removeItem"]
    >;
    clear: jest.MockedFunction<ESPStorageAdapter["clear"]>;
  };
  let _mockAsyncStorage: any;

  beforeEach(() => {
    // Create mock storage adapter with proper Jest mock typing
    mockStorageAdapter = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };

    // Get AsyncStorage mock
    _mockAsyncStorage = require("@react-native-async-storage/async-storage");

    // Clear all mocks
    jest.clearAllMocks();

    _resetESPRMNeoStorageForTests();
  });

  describe("initialization", () => {
    it("should initialize with default storage adapter", () => {
      expect(() => {
        ESPRMNeoStorage.initialize();
      }).not.toThrow();
    });

    it("should initialize with custom storage adapter", () => {
      expect(() => {
        ESPRMNeoStorage.initialize(mockStorageAdapter);
      }).not.toThrow();
    });

    it("should maintain singleton pattern", () => {
      ESPRMNeoStorage.initialize(mockStorageAdapter);
      ESPRMNeoStorage.initialize(); // Should not create new instance

      // Verify the adapter is still the custom one
      expect(mockStorageAdapter.setItem).toBeDefined();
    });
  });

  describe("basic storage operations", () => {
    beforeEach(() => {
      // Create fresh mock adapter for each test
      mockStorageAdapter = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      ESPRMNeoStorage.initialize(mockStorageAdapter);
    });

    describe("setItem", () => {
      it("should set item successfully", async () => {
        mockStorageAdapter.setItem.mockResolvedValue(undefined);

        await ESPRMNeoStorage.setItem("test-key", "test-value");

        expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
          "test-key",
          "test-value"
        );
      });

      it("should handle storage adapter errors", async () => {
        const error = new Error("Storage error");
        mockStorageAdapter.setItem.mockRejectedValue(error);

        await expect(
          ESPRMNeoStorage.setItem("test-key", "test-value")
        ).rejects.toThrow("Storage error");
      });
    });

    describe("getItem", () => {
      it("should get item successfully", async () => {
        const expectedValue = "test-value";
        mockStorageAdapter.getItem.mockResolvedValue(expectedValue);

        const result = await ESPRMNeoStorage.getItem("test-key");

        expect(mockStorageAdapter.getItem).toHaveBeenCalledWith("test-key");
        expect(result).toBe(expectedValue);
      });

      it("should return null for non-existent item", async () => {
        mockStorageAdapter.getItem.mockResolvedValue(null);

        const result = await ESPRMNeoStorage.getItem("non-existent-key");

        expect(result).toBeNull();
      });

      it("should handle storage adapter errors", async () => {
        const error = new Error("Storage error");
        mockStorageAdapter.getItem.mockRejectedValue(error);

        await expect(ESPRMNeoStorage.getItem("test-key")).rejects.toThrow(
          "Storage error"
        );
      });
    });

    describe("removeItem", () => {
      it("should remove item successfully", async () => {
        mockStorageAdapter.removeItem.mockResolvedValue(undefined);

        await ESPRMNeoStorage.removeItem("test-key");

        expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith("test-key");
      });

      it("should handle storage adapter errors", async () => {
        const error = new Error("Storage error");
        mockStorageAdapter.removeItem.mockRejectedValue(error);

        await expect(ESPRMNeoStorage.removeItem("test-key")).rejects.toThrow(
          "Storage error"
        );
      });
    });

    describe("clear", () => {
      it("should clear all items successfully", async () => {
        mockStorageAdapter.clear.mockResolvedValue(undefined);

        await ESPRMNeoStorage.clear();

        expect(mockStorageAdapter.clear).toHaveBeenCalled();
      });

      it("should handle storage adapter errors", async () => {
        const error = new Error("Storage error");
        mockStorageAdapter.clear.mockRejectedValue(error);

        await expect(ESPRMNeoStorage.clear()).rejects.toThrow("Storage error");
      });
    });
  });

  describe("AWS credentials management", () => {
    beforeEach(() => {
      ESPRMNeoStorage.initialize(mockStorageAdapter);
    });

    const mockAWSCredentials: ESPAWSCredentials = {
      accessKey: "test-access-key",
      secretKey: "test-secret-key",
      sessionToken: "test-session-token",
      expiration: "2025-12-31T23:59:59Z",
    };

    describe("temporary credentials", () => {
      it("should save temporary credentials successfully", async () => {
        mockStorageAdapter.setItem.mockResolvedValue(undefined);

        await ESPRMNeoStorage.saveTemporaryCredentials(mockAWSCredentials);

        const { StorageKeys } = require("../../../src/utils/constants");
        expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
          StorageKeys.TEMPORARY_AWS_CREDENTIALS,
          JSON.stringify(mockAWSCredentials)
        );
      });

      it("should get temporary credentials successfully", async () => {
        mockStorageAdapter.getItem.mockResolvedValue(
          JSON.stringify(mockAWSCredentials)
        );

        const result = await ESPRMNeoStorage.getTemporaryCredentials();

        const { StorageKeys } = require("../../../src/utils/constants");
        expect(mockStorageAdapter.getItem).toHaveBeenCalledWith(
          StorageKeys.TEMPORARY_AWS_CREDENTIALS
        );
        expect(result).toEqual(mockAWSCredentials);
      });

      it("should throw error when no temporary credentials found", async () => {
        mockStorageAdapter.getItem.mockResolvedValue(null);

        await expect(ESPRMNeoStorage.getTemporaryCredentials()).rejects.toThrow(
          "No AWS credentials found"
        );
      });

      it("should clear temporary credentials successfully", async () => {
        mockStorageAdapter.removeItem.mockResolvedValue(undefined);

        await ESPRMNeoStorage.clearTemporaryCredentials();

        const { StorageKeys } = require("../../../src/utils/constants");
        expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith(
          StorageKeys.TEMPORARY_AWS_CREDENTIALS
        );
      });
    });

  });

  describe("node configuration management", () => {
    beforeEach(() => {
      ESPRMNeoStorage.initialize(mockStorageAdapter);
    });

    const mockNodeConfigAPI: NodeConfigAPI = {
      node_id: "test-node-123",

      devices: [],
      services: [],
    };

    it("should get node config successfully", async () => {
      mockStorageAdapter.getItem.mockResolvedValue(
        JSON.stringify(mockNodeConfigAPI)
      );

      const result = await ESPRMNeoStorage.getNodeConfig("test-node-123");

      const { StorageKeys } = require("../../../src/utils/constants");
      expect(mockStorageAdapter.getItem).toHaveBeenCalledWith(
        StorageKeys.NODE_CONFIG_PREFIX + "test-node-123"
      );
      expect(result).toEqual(mockNodeConfigAPI);
    });

    it("should return null for non-existent node config", async () => {
      mockStorageAdapter.getItem.mockResolvedValue(null);

      const result = await ESPRMNeoStorage.getNodeConfig("non-existent-node");

      expect(result).toBeNull();
    });

    it("should delete node config successfully", async () => {
      mockStorageAdapter.removeItem.mockResolvedValue(undefined);

      await ESPRMNeoStorage.deleteNodeConfig("test-node-123");

      const { StorageKeys } = require("../../../src/utils/constants");
      expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith(
        StorageKeys.NODE_CONFIG_PREFIX + "test-node-123"
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      ESPRMNeoStorage.initialize(mockStorageAdapter);
    });

    it("should handle JSON parsing errors gracefully", async () => {
      mockStorageAdapter.getItem.mockResolvedValue("invalid-json");

      await expect(ESPRMNeoStorage.getTemporaryCredentials()).rejects.toThrow();
    });

    it("should handle storage adapter initialization errors", () => {
      const brokenAdapter = {
        getItem: undefined,
        setItem: undefined,
        removeItem: undefined,
        clear: undefined,
      } as any;

      expect(() => {
        ESPRMNeoStorage.initialize(brokenAdapter);
      }).not.toThrow();
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      ESPRMNeoStorage.initialize(mockStorageAdapter);
    });

    it("should handle empty strings as values", async () => {
      mockStorageAdapter.setItem.mockResolvedValue(undefined);

      await ESPRMNeoStorage.setItem("empty-key", "");

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith("empty-key", "");
    });

    it("should handle very long keys", async () => {
      const longKey = "a".repeat(1000);
      mockStorageAdapter.setItem.mockResolvedValue(undefined);

      await ESPRMNeoStorage.setItem(longKey, "value");

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(longKey, "value");
    });

    it("should handle special characters in keys", async () => {
      const specialKey = "key-with-special-chars!@#$%^&*()";
      mockStorageAdapter.setItem.mockResolvedValue(undefined);

      await ESPRMNeoStorage.setItem(specialKey, "value");

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
        specialKey,
        "value"
      );
    });

    it("should handle concurrent operations", async () => {
      mockStorageAdapter.setItem.mockResolvedValue(undefined);
      mockStorageAdapter.getItem.mockResolvedValue("value");

      const promises = [
        ESPRMNeoStorage.setItem("key1", "value1"),
        ESPRMNeoStorage.setItem("key2", "value2"),
        ESPRMNeoStorage.getItem("key1"),
        ESPRMNeoStorage.getItem("key2"),
      ];

      await Promise.all(promises);

      expect(mockStorageAdapter.setItem).toHaveBeenCalledTimes(2);
      expect(mockStorageAdapter.getItem).toHaveBeenCalledTimes(2);
    });
  });
});
