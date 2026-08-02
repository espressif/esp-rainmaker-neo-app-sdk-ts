/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Runs one promise per item immediately, keeping at most `poolLimit` in flight
 * (classic async pool: schedule parallel work, throttle with {@link Promise.race}).
 * Results match the order of `items`.
 *
 * @param poolLimit - Max concurrent `iteratorFn` executions (must be ≥ 1)
 * @param items - Input values
 * @param iteratorFn - Async work per item
 */
export async function concurrentFetchPool<T, R>(
  poolLimit: number,
  items: readonly T[],
  iteratorFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (poolLimit < 1) {
    throw new RangeError("concurrentFetchPool: poolLimit must be >= 1");
  }
  if (items.length === 0) {
    return [];
  }

  const executing = new Set<Promise<void>>();
  const results: Promise<R>[] = [];

  for (const [index, item] of items.entries()) {
    const p = Promise.resolve().then(() => iteratorFn(item, index));
    results.push(p);
    const slot: Promise<void> = p.then(
      () => {
        executing.delete(slot);
      },
      () => {
        executing.delete(slot);
      }
    );
    executing.add(slot);
    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}
