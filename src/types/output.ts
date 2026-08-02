/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ESPRMNeoAttributeAPI,
  ESPRMNeoConnectivityStatusInterface,
  ESPRMNeoDeviceAPI,
  ESPRMNeoNodeInfoAPI,
  ESPRMNeoServiceAPI,
} from "./node";
import type { ESPRMNeoDevice } from "../ESPRMNeoDevice";
import type { ESPRMNeoService } from "../ESPRMNeoService";

/**
 * Optional human-readable status text from the API body.
 * Success vs failure is determined by the HTTP status code.
 */
interface ESPAPIResponse {
  message?: string;
  statusCode?: number;
  errorCode?: string;
}

/**
 * Represents an error response from the API.
 */
interface ESPAPIError extends ESPAPIResponse {}

/**
 * Represents a successful response from the API (optional message only).
 */
interface SuccessResponse {
  message?: string;
}

/**
 * Options for sharing a group or subgroup.
 */
export interface ShareOptions {
  username: string;
  accessType: "primary" | "secondary";
}

/**
 * Access type for the current user on a group (GET /v1/groups, GET /v1/groups/{groupId}/users).
 */
export type GroupUserAccessType = "primary" | "secondary" | "subgroup";

/**
 * Raw API response entry for GET /v1/groups/{groupId}/users.
 * @internal
 */
export interface GroupUserInGroup {
  user_id: string;
  email: string;
  phone_number?: string;
  access_type: GroupUserAccessType;
  /** Present when access is via subgroup membership. */
  subgroups?: string[];
}

/**
 * Raw API response body for GET /v1/groups/{groupId}/users.
 * @internal
 */
export interface ListGroupUsersResponse {
  users: GroupUserInGroup[];
}

/**
 * A user with access to a group, as returned by {@link ESPRMNeoGroup.getSharingInfo}.
 */
export interface GroupUser {
  userId: string;
  email: string;
  phoneNumber?: string;
  accessType: GroupUserAccessType;
  /** Present when access is via subgroup membership. */
  subgroups?: string[];
}

/**
 * Result of {@link ESPRMNeoGroup.getSharingInfo}.
 */
export interface GroupSharingInfo {
  users: GroupUser[];
}

interface ConfirmSignUpResponse {
  message?: string;
}

interface ForgotPasswordResponse {
  message?: string;
}

interface SetNewPasswordResponse {
  message?: string;
}

interface ChangePasswordResponse {
  message?: string;
}

interface ESPNodeGroupsResponse extends ESPAPIResponse {
  groups: ESPNodeGroup[];
}

/**
 * Per-node capability information returned by the groups API inside `node_details`.
 */
interface NodeCapabilityInfo {
  capabilities?: Record<string, Record<string, any>>;
}

interface ESPNodeGroup {
  group_id: string;
  group_name: string;
  /** How the user accesses this group (GET /v1/groups). */
  access_type?: GroupUserAccessType;
  node_ids?: string[];
  subgroups?: Subgroup[];
  node_details?: Record<string, NodeCapabilityInfo>;
}

interface Subgroup {
  subgroup_id: string;
  subgroup_name: string;
  node_ids?: string[];
}

/**
 * Represents a group with camelCase properties for SDK use.
 * Nested groups use the same shape; set `parentId` to the parent group’s `groupId` (root groups omit it).
 */
export interface ESPRMNeoGroup {
  groupId: string;
  groupName: string;
  /** How the current user accesses this group (from GET /v1/groups). */
  accessType?: GroupUserAccessType;
  /** Set when this group is nested under another; root groups omit this. */
  parentId?: string;
  nodeIds?: string[];
  subgroups?: ESPRMNeoGroup[];
  nodeDetails?: Record<string, NodeCapabilityInfo>;
}

/**
 * Response from POST /v1/groups/{groupId}/node-assoc-requests
 * Initiates the process of associating a node with a user's group.
 * Generates a request ID and challenge string for the verification step.
 */
interface InitiateNodeAssociationResponse {
  request_id: string;
  challenge: string;
  message?: string;
}

/**
 * Node configuration from the User API / local cache (wire shape).
 *
 * `devices` / `services` are raw snake_case records. {@link ESPRMNeoNode}
 * transforms them into live {@link ESPRMNeoDevice} / {@link ESPRMNeoService}
 * instances on {@link NodeConfig}.
 */
export interface NodeConfigAPI extends ESPAPIResponse {
  node_id?: string;
  devices: ESPRMNeoDeviceAPI[];
  services: ESPRMNeoServiceAPI[];
  config_version?: string;
  info?: ESPRMNeoNodeInfoAPI;
  data_model?: string;
  attributes?: ESPRMNeoAttributeAPI[];
  group_id?: string;
  subgroup_id?: string;
  params?: Record<string, unknown>;
  connectivity_status?: ESPRMNeoConnectivityStatusInterface;
}

/**
 * Runtime node configuration held on {@link ESPRMNeoNode.config}.
 *
 * Same metadata as {@link NodeConfigAPI}, but `devices` / `services` are the
 * live SDK instances (same objects as `node.devices` / `node.services`).
 */
export interface NodeConfig
  extends Omit<NodeConfigAPI, "devices" | "services"> {
  devices: ESPRMNeoDevice[];
  services: ESPRMNeoService[];
}

interface CreateSubgroupResponse extends ESPAPIResponse {
  subgroup_id: string;
}

/**
 * A configured integration entry from GET /v1/integrations (non-admin).
 * Exposes only the id/type and its addressing hint — no credentials or other
 * configuration. Push integrations carry either `bundle_id` (Apple: `apns` /
 * `apns_sandbox`) or `project_id` (Firebase: `gcm`), which callers use to pick
 * the integration matching the current app build.
 */
interface IntegrationInfo {
  integration_id: string;
  /** e.g. `apns`, `apns_sandbox`, `gcm`. */
  integration_type: string;
  /** Apple bundle id, present for `apns` / `apns_sandbox` integrations. */
  bundle_id?: string;
  /** Firebase project id, present for `gcm` integrations. */
  project_id?: string;
}

// Sharing Request Types
interface ListSharingRequestsResponse extends ESPAPIResponse {
  sharing_requests: SharingRequestInfo[];
}

/** Access grade the recipient will hold once a sharing request is accepted. */
export type SharingRequestAccessType = "primary" | "secondary" | "subentity";

interface SharingRequestInfo {
  sharing_request_id: string;
  group_id: string;
  subgroup_id: string;
  access_type: SharingRequestAccessType;
  /** Primary user information who sent the share invitation. */
  primary_user_id?: string;
  primary_email?: string;
  primary_phone_number?: string;
}

export {
  ESPAPIResponse,
  ESPAPIError,
  SuccessResponse,
  ESPNodeGroupsResponse,
  ESPNodeGroup,
  NodeCapabilityInfo,
  Subgroup,
  InitiateNodeAssociationResponse,
  CreateSubgroupResponse,
  IntegrationInfo,
  ListSharingRequestsResponse,
  SharingRequestInfo,
  ConfirmSignUpResponse,
  ForgotPasswordResponse,
  SetNewPasswordResponse,
  ChangePasswordResponse,
};
