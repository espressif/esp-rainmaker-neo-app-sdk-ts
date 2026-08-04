/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPStorageAdapter } from "../../types/storage";

/**
 * Detects a usable `localStorage` at construction time — present on browsers
 * but missing on React Native and most Node.js runtimes.
 */
function detectLocalStorage(): Storage | null {
  if (typeof globalThis === "undefined") return null;
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  return storage ?? null;
}

/**
 * Default storage adapter backed by the runtime's `localStorage`.
 *
 * Only useful on browser-like environments. On React Native and Node.js
 * (which have no `localStorage`), pass a custom adapter to
 * {@link ESPRMNeoStorage.initialize} — for example one backed by
 * `@react-native-async-storage/async-storage`.
 */
export class DefaultStorageAdapter implements ESPStorageAdapter {
  private readonly storage: Storage;

  constructor() {
    const storage = detectLocalStorage();
    if (!storage) {
      throw new Error(
        "DefaultStorageAdapter: no localStorage available on this runtime. " +
          "Pass a custom storage adapter to ESPRMNeoBase.configure() " +
          "(e.g. AsyncStorage on React Native)."
      );
    }
    this.storage = storage;
  }

  async setItem(name: string, value: string): Promise<void> {
    this.storage.setItem(name, value);
  }

  async getItem(name: string): Promise<string | null> {
    return this.storage.getItem(name);
  }

  async removeItem(name: string): Promise<void> {
    this.storage.removeItem(name);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}
