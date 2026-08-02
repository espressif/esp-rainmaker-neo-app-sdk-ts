/// <reference types="jest" />

// Load environment variables from .env.test if it exists
// Note: dotenv is optional - install with: npm install --save-dev dotenv
try {
  const { config } = require("dotenv");
  const { resolve } = require("path");
  config({ path: resolve(__dirname, "../../.env.test") });
} catch (error) {
  // dotenv not installed or .env.test file doesn't exist - this is optional
}

// Global test setup - polyfill crypto.getRandomValues for Jest (Node has it built-in)
try {
  const { webcrypto } = require("crypto");
  if (!global.crypto?.getRandomValues && webcrypto?.getRandomValues) {
    (global as any).crypto = global.crypto || {};
    (global as any).crypto.getRandomValues = webcrypto.getRandomValues.bind(
      webcrypto
    );
  }
} catch {
  // Fallback: simple polyfill using Node's crypto.randomBytes
  const { randomBytes } = require("crypto");
  (global as any).crypto = (global as any).crypto || {};
  (global as any).crypto.getRandomValues = (array: Uint8Array) => {
    const bytes = randomBytes(array.length);
    array.set(bytes);
    return array;
  };
}
// Polyfill fetch for auth methods (Login, SendSignUpCode, ConfirmSignUp) that use it
import "whatwg-fetch";

// Polyfill TextEncoder/TextDecoder for tests
if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("text-encoding");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Setup atob polyfill for JWT decoding
if (typeof global.atob === "undefined") {
  global.atob = (str: string) => {
    const { Buffer } = require("buffer");
    return Buffer.from(str, "base64").toString("binary");
  };
}

// Setup crypto polyfills using crypto-js (similar to the app)
// We need to use the real crypto-js for these polyfills, not the mock
const CryptoJS = require("crypto-js");

// Ensure crypto object exists
if (!global.crypto) {
  (global as any).crypto = {};
}

// Extend the Crypto interface to include our polyfills
interface ExtendedCrypto extends Crypto {
  createHash(algorithm: string): {
    update(data: string | Uint8Array): { digest(encoding: string): string };
    digest(encoding: string): never;
  };
  createHmac(
    algorithm: string,
    key: string
  ): {
    update(data: string | Uint8Array): { digest(encoding?: string): any };
  };
}

// Polyfill crypto.createHash
if (!(global.crypto as ExtendedCrypto).createHash) {
  (global.crypto as ExtendedCrypto).createHash = (algorithm: string) => {
    if (algorithm !== "sha256") {
      throw new Error(`❌ Unsupported hash algorithm: ${algorithm}`);
    }

    let hashedValue: any = null;

    return {
      update: (data: string | Uint8Array) => {
        if (hashedValue !== null) {
          throw new Error(
            `❌ Multiple updates are not allowed in this implementation.`
          );
        }

        // Convert input to CryptoJS WordArray
        const inputBytes =
          typeof data === "string"
            ? CryptoJS.enc.Utf8.parse(data)
            : CryptoJS.lib.WordArray.create(data);

        // Perform SHA256 hashing immediately
        hashedValue = CryptoJS.SHA256(inputBytes);

        return {
          digest: (encoding: string) => {
            if (!hashedValue) {
              throw new Error("❌ No data has been hashed.");
            }
            if (!["hex", "base64"].includes(encoding)) {
              throw new Error(`❌ Unsupported encoding: ${encoding}`);
            }

            // Convert to requested encoding
            return encoding === "hex"
              ? hashedValue.toString(CryptoJS.enc.Hex)
              : hashedValue.toString(CryptoJS.enc.Base64);
          },
        };
      },
      digest: (_encoding: string) => {
        throw new Error(
          "❌ You must call `update(data).digest(encoding)` instead."
        );
      },
    };
  };
}

// Polyfill crypto.createHmac
if (!(global.crypto as ExtendedCrypto).createHmac) {
  (global.crypto as ExtendedCrypto).createHmac = (
    algorithm: string,
    key: string
  ) => {
    if (algorithm !== "sha256") {
      throw new Error(`❌ Unsupported HMAC algorithm: ${algorithm}`);
    }

    return {
      update: (data: string | Uint8Array) => ({
        digest: (encoding?: string) => {
          // Convert key and data to CryptoJS WordArray
          const keyBytes =
            typeof key === "string" ? CryptoJS.enc.Utf8.parse(key) : key;
          const dataBytes =
            typeof data === "string"
              ? CryptoJS.enc.Utf8.parse(data)
              : CryptoJS.lib.WordArray.create(data);

          // Compute HMAC-SHA256
          const hmac = CryptoJS.HmacSHA256(dataBytes, keyBytes);

          if (!encoding) {
            return hmac; // Return raw WordArray
          }
          if (encoding === "hex") {
            return hmac.toString(CryptoJS.enc.Hex);
          }
          if (encoding === "binary") {
            return hmac; // Return WordArray for binary output
          }
          throw new Error(`❌ Unsupported encoding: ${encoding}`);
        },
      }),
    };
  };
}

// Mock console to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore a specific log level
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock React Native modules
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: jest.fn((obj) => obj.ios),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  NativeModules: {
    ESPProvModule: {
      searchESPDevices: jest.fn(),
      stopESPDevicesSearch: jest.fn(),
      createESPDevice: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      scanWifiList: jest.fn(),
      provision: jest.fn(),
      sendData: jest.fn(),
    },
  },
}));

// Mock JWT utils
jest.mock("../../src/services/ESPRMNeoHelpers/DecodeToken", () => ({
  decodeToken: jest.fn().mockReturnValue({
    sub: "test-user-id",
    email: "test@example.com",
    "cognito:username": "test@example.com",
  }),
}));
jest.mock("../../src/services/ESPRMNeoHelpers/CheckTokenExpiry", () => ({
  isTokenExpired: jest.fn().mockReturnValue(false),
}));

// Mock ESPRMNeoStorage
jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage", () => ({
  ESPRMNeoStorage: {
    setItem: jest.fn(),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn(),
    clear: jest.fn(),
    initialize: jest.fn(),
    getNodeConfig: jest.fn().mockResolvedValue(null),
    setNodeConfig: jest.fn().mockResolvedValue(undefined),
    deleteNodeConfig: jest.fn().mockResolvedValue(undefined),
    saveTemporaryCredentials: jest.fn().mockResolvedValue(undefined),
    getTemporaryCredentials: jest.fn().mockResolvedValue(null),
    clearTemporaryCredentials: jest.fn().mockResolvedValue(undefined),
  },
  _resetESPRMNeoStorageForTests: jest.fn(),
}));

// Mock ESPSigV4APIManager
jest.mock("../../src/services/ESPSigV4APIManager", () => ({
  ESPSigV4APIManager: {
    initialize: jest.fn(),
    getInstance: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
    })),
  },
  initializeSigV4APIManager: jest.fn(),
  _resetSigV4APIManagerForTests: jest.fn(),
}));

// Mock ESPRMNeoAuth
jest.mock("../../src/ESPRMNeoAuth", () => {
  return {
    ESPRMNeoAuth: class MockESPRMNeoAuth {
      private config: any;

      constructor(config: any) {
        this.config = config;
      }

      getConfig() {
        return this.config;
      }

      refreshSession = jest.fn().mockResolvedValue({
        accessToken: "mock-access-token",
        idToken: "mock-id-token",
        refreshToken: "mock-refresh-token",
      });
      login = jest.fn().mockResolvedValue({
        accessToken: "mock-access-token",
        idToken: "mock-id-token",
        refreshToken: "mock-refresh-token",
      });
      logout = jest.fn().mockResolvedValue(undefined);
      confirmSignUp = jest.fn().mockResolvedValue(undefined);
      forgotPassword = jest.fn().mockResolvedValue(undefined);
      confirmForgotPassword = jest.fn().mockResolvedValue(undefined);
    },
  };
});

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Note: @react-native-community/netinfo, mqtt, aws-iot-device-sdk-v2, axios
// are mocked via moduleNameMapper in jest.config.js (no packages installed)

// Mock Google Protobuf
jest.mock("google-protobuf", () => ({
  Message: class MockMessage {
    toObject() {
      return {};
    }
    toArray() {
      return [];
    }
    serializeBinary() {
      return new Uint8Array();
    }
  },
  BinaryReader: class MockBinaryReader {
    readString() {
      return "";
    }
    readInt32() {
      return 0;
    }
    readBool() {
      return false;
    }
  },
  BinaryWriter: class MockBinaryWriter {
    writeString() {}
    writeInt32() {}
    writeBool() {}
  },
}));

// Setup global test timeout
jest.setTimeout(30000);
