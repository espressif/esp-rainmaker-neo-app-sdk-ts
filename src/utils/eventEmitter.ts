/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lightweight EventEmitter for browser/RN without relying on Node's `events` module.
 * Listener errors are isolated so one failing callback does not break others.
 */
export class EventEmitter {
  private readonly listeners = new Map<
    string,
    Set<(...args: unknown[]) => void>
  >();

  on(event: string, listener: (...args: unknown[]) => void): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event === undefined) {
      this.listeners.clear();
    } else {
      this.listeners.delete(event);
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) {
      return false;
    }
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch {
        // isolate listener failures
      }
    }
    return true;
  }
}
