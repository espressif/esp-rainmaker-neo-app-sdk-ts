/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Options for {@link ESPRMNeoGroup.setParams} (group control / multicast).
 */
export interface ESPRMNeoGroupSetParamsOptions {
  /**
   * Primary-group scope: target only this subgroup id.
   * Nested subgroup instances always target their own subgroup id.
   */
  subgroupId?: string;
}
