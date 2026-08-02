/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPStorageAdapter } from "../../types/storage";
import { StorageKeys } from "../../utils/constants";
import { DefaultStorageAdapter } from "./DefaultStorageAdapter";
import { ESPAWSCredentials } from "../../types/input";
import { NodeConfigAPI } from "../../types/output";
import { Logger } from "../../utils/logger";

const logger = new Logger("ESPRMNeoStorage");

/**
 * Module-scoped singleton. Constructed only via {@link ESPRMNeoStorage.initialize};
 * cleared by {@link _resetESPRMNeoStorageForTests}.
 */
let instance: ESPRMNeoStorage | undefined;

/**
 * Manages storage operations using a configurable storage adapter.
 */
export class ESPRMNeoStorage {
  /** Storage adapter used for storage operations */
  #storageAdapter: ESPStorageAdapter;

  /**
   * Instantiated only via {@link ESPRMNeoStorage.initialize}; external callers
   * should never `new` this class directly.
   */
  private constructor(customStorageAdapter?: ESPStorageAdapter) {
    this.#storageAdapter = customStorageAdapter || new DefaultStorageAdapter();
  }

  /**
   * Initializes the singleton instance of ESPRMNeoStorage.
   */
  static initialize(customStorageAdapter?: ESPStorageAdapter) {
    instance = new ESPRMNeoStorage(customStorageAdapter);
  }

  /**
   * Gets the singleton instance of ESPRMNeoStorage.
   *
   * @returns The singleton instance of ESPRMNeoStorage.
   */
  static #getInstance(): ESPRMNeoStorage {
    return instance!;
  }

  /**
   * Sets an item in the storage.
   *
   * @param name - The name of the item.
   * @param value - The value to store.
   */
  static async setItem(name: string, value: string): Promise<void> {
    const storage = this.#getInstance();
    await storage.#storageAdapter.setItem(name, value);
  }

  /**
   * Retrieves an item from the storage.
   *
   * @param name - The name of the item.
   * @returns A promise that resolves with the value of the item or null if not found.
   */
  static getItem(name: string): Promise<string | null> {
    const storage = this.#getInstance();
    return storage.#storageAdapter.getItem(name);
  }

  /**
   * Removes an item from the storage.
   *
   * @param name - The name of the item.
   */
  static async removeItem(name: string): Promise<void> {
    const storage = this.#getInstance();
    await storage.#storageAdapter.removeItem(name);
  }

  /**
   * Clears all items from the storage.
   */
  static async clear() {
    const storage = this.#getInstance();
    await storage.#storageAdapter.clear();
  }

  /**
   * Temporary AWS Credentials Management
   */
  public static async saveTemporaryCredentials(
    credentials: ESPAWSCredentials
  ): Promise<void> {
    await this.setItem(
      StorageKeys.TEMPORARY_AWS_CREDENTIALS,
      JSON.stringify(credentials)
    );
  }

  public static async getTemporaryCredentials(): Promise<ESPAWSCredentials> {
    const credentialsString = await this.getItem(
      StorageKeys.TEMPORARY_AWS_CREDENTIALS
    );
    if (!credentialsString) {
      throw new Error("No AWS credentials found");
    }
    return JSON.parse(credentialsString) as ESPAWSCredentials;
  }

  public static async clearTemporaryCredentials(): Promise<void> {
    await this.removeItem(StorageKeys.TEMPORARY_AWS_CREDENTIALS);
  }

  /**
   * Node Config Management
   *
   * Node configs are stored as JSON under `NODE_CONFIG_PREFIX + nodeId`. All
   * three methods below encapsulate that layout so no other file needs to
   * know how a node config is serialized.
   */
  public static async getNodeConfig(
    nodeId: string
  ): Promise<NodeConfigAPI | null> {
    const raw = await this.getItem(StorageKeys.NODE_CONFIG_PREFIX + nodeId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NodeConfigAPI;
    } catch (parseError) {
      // A bad blob would otherwise poison every subsequent read; treat it as
      // a cache miss and let the caller repopulate on the next cloud fetch.
      logger.warn("Corrupted cached node config; treating as missing", {
        nodeId,
        error:
          parseError instanceof Error
            ? parseError.message
            : String(parseError),
      });
      return null;
    }
  }

  public static async setNodeConfig(
    nodeId: string,
    config: NodeConfigAPI
  ): Promise<void> {
    await this.setItem(
      StorageKeys.NODE_CONFIG_PREFIX + nodeId,
      JSON.stringify(config)
    );
  }

  public static async deleteNodeConfig(nodeId: string): Promise<void> {
    await this.removeItem(StorageKeys.NODE_CONFIG_PREFIX + nodeId);
  }
}

/**
 * Clears the storage singleton so {@link ESPRMNeoStorage.initialize} can run
 * again after SDK dispose. Test / teardown only; not re-exported.
 *
 * @internal
 */
export function _resetESPRMNeoStorageForTests(): void {
  instance = undefined;
}
