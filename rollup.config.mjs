/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import typescript from "rollup-plugin-typescript2";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { defineConfig } from "rollup";

// Get all external dependencies from package.json
const external = [
  "google-protobuf",
];

// ESM Configuration
const esmConfig = defineConfig({
  input: "src/index.ts",
  output: {
    dir: "dist/esm",
    format: "es",
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: "src",
    entryFileNames: "[name].js",
  },
  external,
  plugins: [
    resolve({
      preferBuiltins: true,
      extensions: [".js", ".ts"],
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: "tsconfig.json",
      tsconfigOverride: {
        compilerOptions: {
          declaration: false,
          declarationMap: false,
        },
      },
      clean: true,
    }),
  ],
});

// CommonJS Configuration
const cjsConfig = defineConfig({
  input: "src/index.ts",
  output: {
    dir: "dist/cjs",
    format: "cjs",
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: "src",
    entryFileNames: "[name].js",
    exports: "named",
  },
  external,
  plugins: [
    resolve({
      preferBuiltins: true,
      extensions: [".js", ".ts"],
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: "tsconfig.json",
      tsconfigOverride: {
        compilerOptions: {
          declaration: true,
          declarationDir: "dist/types",
        },
      },
      useTsconfigDeclarationDir: true,
    }),
  ],
});

export default [esmConfig, cjsConfig];
