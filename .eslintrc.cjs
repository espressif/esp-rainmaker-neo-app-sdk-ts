/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["dist/", "node_modules/", "docs/", "*.cjs", "*.mjs"],
  overrides: [
    {
      // Generated protobuf bindings — relax stylistic rules that the
      // generator's output cannot satisfy.
      files: ["src/proto/**/*.ts"],
      rules: {
        "@typescript-eslint/no-namespace": "off",
        "@typescript-eslint/ban-types": "off",
        "no-empty": "off",
      },
    },
    {
      // Lint ratchet: there is ONE way to fake the backend.
      // Re-mocking the API managers per file is how the five legacy mocking
      // patterns grew — new tests use setupSdkTest() from
      // test-utils/sdk-test-harness. The only sanctioned module mock lives
      // in the global __tests__/utils/setup.ts.
      files: ["__tests__/**/*.ts"],
      excludedFiles: [
        // The global module mock itself.
        "__tests__/utils/setup.ts",
        // The workflow project has no global setup.ts — its suites install
        // MockApiManager via jest.mock, which IS the harness path there.
        "__tests__/workflow/**",
      ],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "CallExpression[callee.object.name='jest'][callee.property.name='mock'] > Literal[value=/ESPSigV4APIManager|ESPRMNeoAPIManager/]",
            message:
              "Do not jest.mock the API managers in a test file — use setupSdkTest() (test-utils/sdk-test-harness). The global mock lives in __tests__/utils/setup.ts.",
          },
        ],
      },
    },
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-var-requires": "off",
  },
};
