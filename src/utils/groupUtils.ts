/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoGroup, isChildGroup } from "../ESPRMNeoGroup";

type RootPathFn<A extends unknown[]> = (groupId: string, ...args: A) => string;
type SubgroupPathFn<A extends unknown[]> = (
  parentId: string,
  groupId: string,
  ...args: A
) => string;

/**
 * Resolves a group API path for a root group vs nested subgroup.
 *
 * - Root: `root(group.groupId, ...args)`
 * - Child: `subgroup(group.parentId, group.groupId, ...args)`
 */
export function resolveGroupPath<A extends unknown[]>(
  group: ESPRMNeoGroup,
  root: RootPathFn<A>,
  subgroup: SubgroupPathFn<A>,
  ...args: A
): string {
  return isChildGroup(group)
    ? subgroup(group.parentId!, group.groupId, ...args)
    : root(group.groupId, ...args);
}

/**
 * PATCH body for renaming a root group (`group_name`) or nested subgroup
 * (`subgroup_name`).
 */
export function buildGroupNameBody(
  group: ESPRMNeoGroup,
  name: string
): { group_name: string } | { subgroup_name: string } {
  return isChildGroup(group)
    ? { subgroup_name: name }
    : { group_name: name };
}
