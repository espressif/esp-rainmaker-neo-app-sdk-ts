/** @type {import('jest').Config} */
export default {
  coverageReporters: [
    "text",
    "lcov",
    "html",
    "json-summary",
    ["cobertura", { file: "cobertura-coverage.xml" }],
  ],
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "./",
        outputName: "junit.xml",
        suiteName: "jest tests",
        classNameTemplate: "{classname}",
        titleTemplate: "{title}",
        ancestorSeparator: " > ",
        usePathForSuiteName: true,
      },
    ],
  ],
  coverageDirectory: "coverage",
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.test.json",
          },
        ],
      },
      testMatch: [
        "**/__tests__/**/*.(test|spec).(ts|tsx|js)",
        "**/__tests__/**/*.test.(ts|tsx|js)",
        "**/__tests__/**/*.spec.(ts|tsx|js)",
      ],
      testPathIgnorePatterns: [
        "/node_modules/",
        "/dist/",
        "/coverage/",
        "/.git/",
        "/integration/",
        "/contract/",
        "/workflow/",
        "/adapter/",
        "/helpers/",
        "/utils/__mocks__/",
        "/utils/mock",
        "/utils/configure",
        "/utils/setup.ts",
      ],
      collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/index.ts",
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 75,
          lines: 70,
          statements: 70,
        },
      },
      setupFilesAfterEnv: ["<rootDir>/__tests__/utils/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^uuid$": "<rootDir>/__tests__/utils/__mocks__/uuid.ts",
        "^aws-amplify$": "<rootDir>/__tests__/utils/__mocks__/aws-amplify.ts",
        "^@react-native-community/netinfo$":
          "<rootDir>/__tests__/utils/__mocks__/netinfo.ts",
        "^mqtt$": "<rootDir>/__tests__/utils/__mocks__/mqtt.ts",
        "^aws-iot-device-sdk-v2$":
          "<rootDir>/__tests__/utils/__mocks__/aws-iot-device-sdk-v2.ts",
        "^axios$": "<rootDir>/__tests__/utils/__mocks__/axios.ts",
      },
      // 50% of available CPUs — machine-agnostic sweet spot.
      // Default (cpus-1) over-provisions workers for this suite size (35 files, ~100ms each)
      // causing worker-spawn overhead to dominate. 50% avoids that on both dev machines
      // (10 CPUs → 5 workers) and typical CI runners (2 CPUs → 1 worker).
      maxWorkers: "50%",
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
      transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
    },
    {
      displayName: "integration",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.test.json",
          },
        ],
      },
      testMatch: [
        "**/__tests__/integration/**/*.(test|spec).(ts|tsx|js)",
        "**/__tests__/integration/**/*.test.(ts|tsx|js)",
        "**/__tests__/integration/**/*.spec.(ts|tsx|js)",
      ],
      testPathIgnorePatterns: [
        "/node_modules/",
        "/dist/",
        "/coverage/",
        "/.git/",
        "/helpers/",
        "/utils/__mocks__/",
        "/utils/mock",
        "/utils/configure",
      ],
      collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/index.ts",
      ],
      coverageThreshold: {
        global: {
          branches: 60,
          functions: 65,
          lines: 60,
          statements: 60,
        },
      },
      setupFilesAfterEnv: ["<rootDir>/__tests__/integration/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^@react-native-community/netinfo$":
          "<rootDir>/__tests__/utils/__mocks__/netinfo.ts",
        "^mqtt$": "<rootDir>/__tests__/utils/__mocks__/mqtt.ts",
        "^aws-iot-device-sdk-v2$":
          "<rootDir>/__tests__/utils/__mocks__/aws-iot-device-sdk-v2.ts",
        "^axios$": "<rootDir>/__tests__/utils/__mocks__/axios.ts",
      },
      clearMocks: false,
      resetMocks: false,
      restoreMocks: false,
      transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
    },
    {
      // Contract layer: verifies the generated schema bundle itself (and, when
      // run against a live backend, real responses) — schemas compile under
      // strict AJV and match the vendored spec. Network-free, safe in PR CI.
      displayName: "contract",
      preset: "ts-jest",
      testEnvironment: "node",
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.test.json",
          },
        ],
      },
      testMatch: ["**/__tests__/contract/**/*.(test|spec).(ts|tsx|js)"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/", "/.git/"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      clearMocks: true,
      transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
    },
    {
      // Workflow layer: SDK integration tests that drive multiple real SDK
      // modules through a business workflow with only the HTTP boundary stubbed
      // by schema-validated responses. Deterministic and offline — safe in PR CI.
      displayName: "workflow",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
      },
      testMatch: ["**/__tests__/workflow/**/*.(test|spec).(ts|tsx|js)"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/", "/.git/"],
      setupFilesAfterEnv: ["<rootDir>/__tests__/utils/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^uuid$": "<rootDir>/__tests__/utils/__mocks__/uuid.ts",
        "^aws-amplify$": "<rootDir>/__tests__/utils/__mocks__/aws-amplify.ts",
        "^@react-native-community/netinfo$":
          "<rootDir>/__tests__/utils/__mocks__/netinfo.ts",
        "^mqtt$": "<rootDir>/__tests__/utils/__mocks__/mqtt.ts",
        "^aws-iot-device-sdk-v2$":
          "<rootDir>/__tests__/utils/__mocks__/aws-iot-device-sdk-v2.ts",
        "^axios$": "<rootDir>/__tests__/utils/__mocks__/axios.ts",
      },
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
      transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
    },
    {
      // Adapter layer: runs every native-capability adapter (mock, and in the
      // future Android/iOS/Web bridges) through one shared contract suite.
      displayName: "adapter",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
      },
      testMatch: ["**/__tests__/adapter/**/*.(test|spec).(ts|tsx|js)"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/", "/.git/"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      clearMocks: true,
      transformIgnorePatterns: ["node_modules/(?!(uuid)/)"],
    },
  ],
};
