/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An object containing the HTTP methods commonly used in API requests.
 *
 * @enum {string}
 */
const HTTPMethods = {
  /** Represents the GET HTTP method. */
  GET: "GET",
  /** Represents the PUT HTTP method. */
  PUT: "PUT",
  /** Represents the POST HTTP method. */
  POST: "POST",
  /** Represents the DELETE HTTP method. */
  DELETE: "DELETE",
};

/**
 * An object containing the API endpoint paths used in the application.
 *
 * @enum {string}
 */
const APIEndpoints = {
  /** The endpoint for user operations. */
  USER: "/user2",
  /** The endpoint for password recovery. */
  FORGOTPASSWORD: "/forgotpassword2",
  /** The endpoint for user login. */
  LOGIN: "/login2",
  /** The endpoint for password operations. */
  PASSWORD: "/password2",
  /** The endpoint for user logout. */
  LOGOUT: "/logout2",
  /** The endpoint for token operations. */
  TOKEN: "/token",
  /** The endpoint for user node groups. */
  USER_GROUP: "/group",
  /** The endpoint for user nodes mapping. */
  USER_NODE_MAP: "/user/nodes/mapping",
  /** The endpoint for user nodes. */
  USER_NODE: "/user/nodes",
  /** The endpoint for user nodes params. */
  USER_NODE_PARAM: "/user/nodes/params",
  /** The endpoint for user node status. */
  USER_NODE_STATUS: "/user/nodes/status",
  /** The endpoint for user node config. */
  USER_NODE_CONFIG: "/user/nodes/config",
  /** The endpoint for user node sharing. */
  USER_NODE_SHARING: "/user/nodes/sharing",
  /** The endpoint for user node sharing requests/invitations. */
  USER_NODE_SHARING_REQUESTS: "/sharing_requests",
  /** The endpoint for user node group sharing info. */
  USER_GROUP_SHARING: "/user/node_group/sharing",
  /** The endpoint for user node group sharing requests/invitations. */
  USER_GROUP_SHARING_REQUESTS: "/user/node_group/sharing/requests",
  /** The endpoint for user push notifications mobile platform endpoint. */
  USER_PUSH_NOTIFICATION_MOBILE_PLATFORM_ENDPOINT:
    "/user/push_notification/mobile_platform_endpoint",
  /** @deprecated moved to APIPathV1.ASSUME_ROLE */
  ASSUME_ROLE: "/v1/assumed-roles",
  /** @deprecated moved to APIPathV1.USER_CREDENTIALS */
  USER_CREDENTIALS: "/v1/user/credentials",
  INITIATE_NODE_ASSOCIATION: "/initiate",
  VERIFY_NODE_ASSOCIATION: "/verify",
  REGISTER_CLIENT: "/register_client",
  REGISTER_SUB: "/register_sub",
  ALEXA_CONFIG: "/alexa_cfg",
};

/**
 * Storage keys use namespacing: rmneo (SDK) → module → key
 * to avoid collisions when multiple SDKs share the same storage adapter.
 */
const StorageKeys = {
  /** rmneo.auth.* – auth tokens */
  ACCESSTOKEN: "rmneo.auth.accessToken",
  IDTOKEN: "rmneo.auth.idToken",
  REFRESHTOKEN: "rmneo.auth.refreshToken",
  USER_DEVICETOKEN_MAP: "rmneo.auth.userDeviceTokenMap",

  /** rmneo.credentials.* – AWS credentials */
  AWS_CREDENTIALS: "rmneo.credentials.aws",
  /** Temporary AWS credentials (e.g. from GetTemporaryAWSCredentials). */
  TEMPORARY_AWS_CREDENTIALS: "rmneo.credentials.temporary",

  /** rmneo.nodes.* – node-related data; use prefix + id for per-item keys */
  /**
   * Local-storage key prefix for cached node configs.
   * Full key = `NODE_CONFIG_PREFIX + nodeId` (e.g. `rmneo.nodes.config.<nodeId>`).
   * Read when `getNode` / `getNodes` are called with `cache: true`; written on
   * every successful cloud fetch.
   */
  NODE_CONFIG_PREFIX: "rmneo.nodes.config.",
  /**
   * Single blob storing `{ [nodeId]: string }` — the last-seen `ncfg_ver`
   * from each node's IoT shadow. The value is a lowercase hex SHA256 of the
   * generated node config (previously an integer timestamp; legacy numbers
   * are normalized to strings). Used to detect schema changes and invalidate
   * the local config cache. See `hasNcfgVersionChanged`.
   */
  NCFG_VERSIONS: "rmneo.nodes.ncfgVersions",
};

/**
 * An object containing error codes related to configuration issues.
 *
 * @enum {string}
 */
const ConfigErrorCodes = {
  /** Error code indicating the SDK is not initialized. */
  SDK_NOT_CONFIGURED: "SDK_NOT_CONFIGURED",
  /** Error code indicating the provided configuration object is invalid. */
  INVALID_CONFIG_OBJECT: "INVALID_CONFIG_OBJECT",
  /** Error code indicating the base URL is invalid. */
  INVALID_BASE_URL: "INVALID_BASE_URL",
  /** Error code indicating an invalid transport mode. */
  INVALID_TRANSPORT_MODE: "INVALID_TRANSPORT_MODE",
  /** Error code indicating the transport order is empty or not an array. */
  INVALID_TRANSPORT_ORDER: "INVALID_TRANSPORT_ORDER",
  /** Error code indicating the AWS region is invalid. */
  INVALID_REGION: "INVALID_REGION",
  /** Error code indicating an invalid storage adapter. */
  INVALID_STORAGE_ADAPTER: "INVALID_STORAGE_ADAPTER",
  /** Error code indicating an invalid MQTT adapter. */
  INVALID_MQTT_ADAPTER: "INVALID_MQTT_ADAPTER",
  /** Error code indicating the IoT endpoint is invalid or empty. */
  INVALID_IOT_ENDPOINT: "INVALID_IOT_ENDPOINT",
  /** Error code indicating an invalid provisioning adapter. */
  INVALID_PROVISION_ADAPTER: "INVALID_PROVISION_ADAPTER",
  /** Error code indicating an invalid local control adapter. */
  INVALID_LOCAL_CONTROL_ADAPTER: "INVALID_LOCAL_CONTROL_ADAPTER",
  /** Error code indicating an invalid local discovery adapter. */
  INVALID_LOCAL_DISCOVERY_ADAPTER: "INVALID_LOCAL_DISCOVERY_ADAPTER",
  /** Error code indicating the User/auth API base URL is missing or empty. */
  INVALID_USER_API_BASE: "INVALID_USER_API_BASE",
} as const;

/**
 * An object containing error codes related to validation issues.
 *
 * @enum {string}
 */
const ValidationErrorCodes = {
  /** Error code indicating the login password is missing. */
  MISSING_LOGIN_PASSWORD: "MISSING_LOGIN_PASSWORD",
} as const;

/**
 * An object containing error codes related to storage adapter issues.
 *
 * @enum {string}
 */
const StorageAdapterErrorCodes = {
  /** Error code indicating the default storage adapter API is unsupported. */
  UNSUPPORTED_DEFAULT_STORAGE_ADAPTER_API:
    "UNSUPPORTED_DEFAULT_STORAGE_ADAPTER_API",
} as const;

/**
 * An object containing error codes related to API call validation issues.
 *
 * @enum {string}
 */
const APICallValidationErrorCodes = {
  /** Error code indicating the group ID is missing. */
  MISSING_GROUP_ID: "MISSING_GROUP_ID",
  /** Error code indicating the group name is missing. */
  MISSING_GROUP_NAME: "MISSING_GROUP_NAME",
  /** Error code indicating the node list is missing. */
  MISSING_NODE_LIST: "MISSING_NODE_LIST",
  /** Error code indicating the node ID is missing. */
  MISSING_NODE_ID: "MISSING_NODE_ID",
  /** Error code indicating the parent node WeakRef has been garbage collected. */
  MISSING_NODE_REF: "MISSING_NODE_REF",
  /** Error code indicating the secret key is missing. */
  MISSING_SECRET_KEY: "MISSING_SECRET_KEY",
  /** Error code indicating the group update info is missing. */
  MISSING_GROUP_UPDATE_INFO: "MISSING_GROUP_UPDATE_INFO",
  /** Error code indicating the delete endpoint parameters are missing. */
  MISSING_DELETE_ENDPOINT_PARAMS: "MISSING_DELETE_ENDPOINT_PARAMS",
  /** Error code indicating the device list refresh is required. */
  DEVICE_LIST_REFRESH_REQUIRED: "DEVICE_LIST_REFRESH_REQUIRED",
  /** Error code indicating the node is unreachable. */
  NODE_UNREACHABLE: "NODE_UNREACHABLE",
  /** Error code indicating invalid event type. */
  INVALID_EVENT_TYPE: "INVALID_EVENT_TYPE",
  /** Error code indicating the base URL is missing. */
  MISSING_BASE_URL: "MISSING_BASE_URL",
  /** Error code indicating the automation action index is invalid. */
  INVALID_ACTION_INDEX: "INVALID_ACTION_INDEX",
  /** Error code indicating the automation ID is missing. */
  MISSING_AUTOMATION_ID: "MISSING_AUTOMATION_ID",
  /** Error code indicating the automation name is missing. */
  MISSING_AUTOMATION_NAME: "MISSING_AUTOMATION_NAME",
  /** Error code indicating the automation conditions are missing. */
  MISSING_AUTOMATION_CONDITIONS: "MISSING_AUTOMATION_CONDITIONS",
  /** Error code indicating the automation actions are missing. */
  MISSING_AUTOMATION_ACTIONS: "MISSING_AUTOMATION_ACTIONS",
  /** Error code indicating setParams was called with an empty or missing params object. */
  MISSING_PARAMS: "MISSING_PARAMS",
  /** Error code indicating the trigger item is missing or invalid. */
  MISSING_TRIGGER: "MISSING_TRIGGER",
  /** Error code indicating the trigger ID is missing or empty. */
  MISSING_TRIGGER_ID: "MISSING_TRIGGER_ID",
  /** Error code indicating a trigger with the same id already exists. */
  TRIGGER_ALREADY_EXISTS: "TRIGGER_ALREADY_EXISTS",

  /** Error code indicating the action target is invalid or missing required fields. */
  INVALID_ACTION_TARGET: "INVALID_ACTION_TARGET",
  /** Error code indicating options.dataType is missing for a custom time-series key. */
  MISSING_TS_CUSTOM_KEY_DATA_TYPE: "MISSING_TS_CUSTOM_KEY_DATA_TYPE",
  /** Error code indicating the time-series param carries no data type. */
  MISSING_TS_DATA_TYPE: "MISSING_TS_DATA_TYPE",
  /** Error code indicating the time-series param was not found on the node's config. */
  TS_PARAM_NOT_FOUND: "TS_PARAM_NOT_FOUND",
  /** Error code indicating the start time is missing for a raw time-series query. */
  MISSING_TS_START_TIME: "MISSING_TS_START_TIME",
  /** Error code indicating the time-series aggregation window is missing or invalid. */
  INVALID_TS_WINDOW: "INVALID_TS_WINDOW",
  /** Error code indicating the schedule item is missing or invalid. */
  MISSING_SCHEDULE: "MISSING_SCHEDULE",
  /** Error code indicating the schedule id is missing or empty. */
  MISSING_SCHEDULE_ID: "MISSING_SCHEDULE_ID",
  /** Error code indicating the schedules argument is not an array. */
  INVALID_SCHEDULES: "INVALID_SCHEDULES",
  /** Error code indicating the nodeSchedules argument is not an array. */
  INVALID_NODE_SCHEDULES: "INVALID_NODE_SCHEDULES",
  /** Error code indicating schedule.enabled is missing or not a boolean. */
  INVALID_SCHEDULE_ENABLED: "INVALID_SCHEDULE_ENABLED",
  /** Error code indicating schedule.triggers is missing or not an array. */
  INVALID_SCHEDULE_TRIGGERS: "INVALID_SCHEDULE_TRIGGERS",
  /** Error code indicating schedule.action is missing or not an object. */
  INVALID_SCHEDULE_ACTION: "INVALID_SCHEDULE_ACTION",
  /** Error code indicating a schedule with the same id already exists. */
  SCHEDULE_ALREADY_EXISTS: "SCHEDULE_ALREADY_EXISTS",
  /** Error code indicating the schedule was not found on the node. */
  SCHEDULE_NOT_FOUND: "SCHEDULE_NOT_FOUND",
  /** Error code indicating the trigger was not found on the node. */
  TRIGGER_NOT_FOUND: "TRIGGER_NOT_FOUND",
  /** Error code indicating the schedule's node could not be resolved. */
  SCHEDULE_NODE_NOT_FOUND: "SCHEDULE_NODE_NOT_FOUND",
  /** Error code indicating addNode was called on a root group. */
  ADD_NODE_REQUIRES_NESTED_GROUP: "ADD_NODE_REQUIRES_NESTED_GROUP",
  /** Error code indicating the node is already in the group. */
  NODE_ALREADY_IN_GROUP: "NODE_ALREADY_IN_GROUP",
  /** Error code indicating the node config could not be resolved. */
  NODE_CONFIG_UNRESOLVED: "NODE_CONFIG_UNRESOLVED",
  /** Error code indicating the user ID is missing. */
  MISSING_USER_ID: "MISSING_USER_ID",
  /** Error code indicating the username is missing for group sharing. */
  MISSING_USERNAME: "MISSING_USERNAME",
  /** Error code indicating removeMember was called with the current-user alias. */
  USE_LEAVE_FOR_CURRENT_USER: "USE_LEAVE_FOR_CURRENT_USER",
} as const;

/**
 * An object containing API operations.
 *
 * @enum {string}
 */
const APIOperations = {
  /** Represents the add operation. */
  ADD: "add",
  /** Represents the remove operation. */
  REMOVE: "remove",
} as const;

/**
 * An object containing error codes related to token access issues.
 *
 * @enum {string}
 */
const TokenErrorCodes = {
  /** Error code indicating the access token is missing. */
  MISSING_ACCESS_TOKEN: "MISSING_ACCESS_TOKEN",
  /** Error code indicating the ID token is missing. */
  MISSING_ID_TOKEN: "MISSING_ID_TOKEN",
  /** Error code indicating the refresh token is missing. */
  MISSING_REFRESH_TOKEN: "MISSING_REFRESH_TOKEN",
  /** Error code indicating the session extension failed. */
  EXTEND_SESSION_FAILED: "EXTEND_SESSION_FAILED",
} as const;

/**
 * An object containing error codes related to authentication operations.
 *
 * @enum {string}
 */
const AuthErrorCodes = {
  /** Error code indicating the user is not logged in. */
  NOT_LOGGED_IN: "NOT_LOGGED_IN",
  /** Error code indicating password recovery initiation failed. */
  FORGOT_PASSWORD_FAILED: "FORGOT_PASSWORD_FAILED",
  /** Error code indicating loading the logged-in user failed. */
  GET_LOGGED_IN_USER_FAILED: "GET_LOGGED_IN_USER_FAILED",
  /** Error code indicating login failed. */
  LOGIN_FAILED: "LOGIN_FAILED",
  /** Error code indicating login/OTP response is missing required tokens. */
  LOGIN_FAILED_MISSING_TOKENS: "LOGIN_FAILED_MISSING_TOKENS",
  /** Error code indicating token refresh response is missing required tokens. */
  TOKEN_REFRESH_FAILED_MISSING_TOKENS: "TOKEN_REFRESH_FAILED_MISSING_TOKENS",
  /** Error code indicating OTP verification failed. */
  OTP_VERIFICATION_FAILED: "OTP_VERIFICATION_FAILED",
  /** Error code indicating OTP verification returned no authentication result. */
  OTP_NO_AUTH_RESULT: "OTP_NO_AUTH_RESULT",
  /** Error code indicating OTP request failed. */
  OTP_REQUEST_FAILED: "OTP_REQUEST_FAILED",
  /** Error code indicating OTP request returned no session token. */
  OTP_SESSION_TOKEN_FAILED: "OTP_SESSION_TOKEN_FAILED",
  /** Error code indicating sign-up failed. */
  SIGNUP_FAILED: "SIGNUP_FAILED",
  /** Error code indicating sign-up confirmation failed. */
  CONFIRM_SIGNUP_FAILED: "CONFIRM_SIGNUP_FAILED",
  /** Error code indicating password change failed. */
  CHANGE_PASSWORD_FAILED: "CHANGE_PASSWORD_FAILED",
  /** Error code indicating password reset confirmation failed. */
  PASSWORD_RESET_FAILED: "PASSWORD_RESET_FAILED",
} as const;

/**
 * Fallback success messages for authentication operations.
 */
const AuthSuccessMessages = {
  /** Message returned when the password was changed successfully. */
  PASSWORD_CHANGED: "Password has been changed successfully",
  /** Message returned when sign-up was confirmed successfully. */
  USER_CONFIRMED: "User confirmed successfully",
  /** Message returned when the password was reset successfully. */
  PASSWORD_RESET: "Password has been reset successfully",
} as const;

/**
 * Fallback success messages for automation operations.
 */
const AutomationSuccessMessages = {
  /** Message returned when the condition was already present. */
  CONDITION_ALREADY_ADDED: "Condition already added",
  /** Message returned when the automation was deleted successfully. */
  AUTOMATION_DELETED: "Automation deleted successfully",
} as const;

/**
 * Automation enable/disable status values stored by the backend.
 */
const AutomationStatusValues = {
  /** Automation is active. */
  ENABLED: "enabled",
  /** Automation is inactive. */
  DISABLED: "disabled",
} as const;

/**
 * Fallback success messages for group operations.
 */
const GroupSuccessMessages = {
  /** Message returned when a node was added to the group successfully. */
  NODE_ADDED: "Node added successfully",
  /** Message returned when a node was removed from the group successfully. */
  NODE_REMOVED: "Node removed successfully",
  /** Message returned when the current user left the group successfully. */
  LEFT_GROUP: "Left group successfully",
  /** Message returned when a member was removed from the group successfully. */
  MEMBER_REMOVED: "Member removed successfully",
  /** Message returned when group parameters were set successfully. */
  PARAMS_SET: "Parameters set successfully",
  /** Message returned when the group name was updated successfully. */
  NAME_UPDATED: "Name updated successfully",
} as const;

/**
 * Fallback success messages for node operations.
 */
const NodeSuccessMessages = {
  /** Message returned when the node was deleted successfully. */
  NODE_DELETED: "Node deleted successfully",
} as const;

/**
 * Warning messages for best-effort node cache cleanup.
 */
const NodeWarnMessages = {
  /** Logged when removing a cached node config fails. */
  NODE_CONFIG_CACHE_REMOVE_FAILED: "Failed to remove cached node config",
  /** Logged when clearing the ncfg version marker fails. */
  NCFG_VERSION_MARKER_CLEAR_FAILED: "Failed to clear ncfg version marker",
} as const;

/**
 * Fallback success messages for schedule operations.
 */
const ScheduleSuccessMessages = {
  /** Message returned when schedules were set on a node. */
  SET: "Schedules set successfully",
  /** Message returned when all schedules on a node were deleted. */
  ALL_DELETED: "All schedules deleted successfully",
} as const;

/**
 * Error message builders for schedule batch operations.
 */
const ScheduleErrorMessages = {
  /** Message when creating schedules failed on one or more nodes. */
  CREATE_FAILED: (failed: number, total: number, summary: string) =>
    `Failed to create schedules on ${failed} of ${total} nodes — ${summary}`,
} as const;

/**
 * Error / log messages for trigger operations.
 */
const TriggerErrorMessages = {
  /** Logged when retrieving triggers for a node fails. */
  GET_FAILED: "getTriggers failed",
} as const;

/**
 * Error messages for assumeRole (POST /v1/assumed-roles).
 */
const AssumeRoleErrorMessages = {
  /** Thrown when `services` is provided without a `nodeId`. */
  NODE_ID_REQUIRED: "assumeRole: nodeId is required when services is provided",
  /** Thrown when the assume-role response is missing required credential fields. */
  INVALID_RESPONSE:
    "Invalid assume role response: missing required credential fields",
} as const;

/**
 * Error / log messages for temporary AWS credentials (POST /v1/user/credentials).
 */
const AWSCredentialsErrorMessages = {
  /** Thrown / logged when the Cognito access token is missing from storage. */
  MISSING_ACCESS_TOKEN: "Missing access token - user must be logged in",
  /** Thrown / logged when the Cognito ID token is missing from storage. */
  MISSING_ID_TOKEN: "Missing ID token - user must be logged in",
  /** Thrown when the credentials API response is missing required fields. */
  INCOMPLETE_CREDENTIALS: "Incomplete AWS credentials received",
  /** Thrown when the credentials HTTP call fails at the network layer. */
  NETWORK_ERROR: (detail: string) =>
    `Network error while calling /v1/user/credentials: ${detail}`,
  /** Thrown when the credentials response body cannot be read. */
  READ_RESPONSE_FAILED: (detail: string) =>
    `Failed to read response: ${detail}`,
  /** Fallback when the credentials API returns a non-OK status with an empty body. */
  HTTP_ERROR: (status: number) => `HTTP error! status: ${status}`,
  /** Logged when fetchTemporaryAWSCredentials starts. */
  FETCH_CALLED: "fetchTemporaryAWSCredentials called",
  /** Logged when temporary credentials are fetched and persisted successfully. */
  FETCH_SUCCESS: "Temporary AWS credentials fetched and saved",
  /** Logged when the ID token is expired/invalid and a session refresh is started. */
  ID_TOKEN_REFRESH:
    "ID token expired or invalid; refreshing session before credentials",
  /** Logged when retrying after a 401 expired-token response. */
  CREDENTIALS_RETRY: (attempt: number, max: number) =>
    `Credentials returned 401 expired token; refreshing and retrying (attempt ${attempt}/${max})`,
  /** Logged when the credentials API returns a non-retryable error. */
  API_ERROR: "API error",
  /** Logged when incomplete credentials are received from the API. */
  INCOMPLETE_CREDENTIALS_LOG: "Incomplete credentials received",
} as const;

/**
 * Fallback success messages for trigger operations.
 */
const TriggerSuccessMessages = {
  /** Message returned when triggers were set on a node. */
  SET: "Triggers set successfully",
  /** Message returned when all triggers on a node were deleted. */
  ALL_DELETED: "All triggers deleted successfully",
} as const;

/**
 * Fallback success messages for sharing-request operations.
 */
const SharingSuccessMessages = {
  /** Message returned when a sharing request was accepted successfully. */
  ACCEPTED: "Sharing request accepted",
  /** Message returned when a sharing request was declined successfully. */
  DECLINED: "Sharing request declined",
} as const;

/**
 * Fallback success messages for integration endpoint operations.
 */
const IntegrationSuccessMessages = {
  /** Message returned when an integration endpoint was unregistered successfully. */
  ENDPOINT_UNREGISTERED: "Endpoint unregistered successfully",
} as const;

/**
 * Path alias for the authenticated caller in group user APIs.
 */
const GroupUserAliases = {
  /** Resolves to the authenticated caller (`DELETE .../users/me`). */
  CURRENT: "me",
} as const;

/**
 * Provision type for device provisioning flow.
 * chal_resp = challenge-response flow (initiate → send challenge → verify → set credentials)
 */
const ProvisionType = {
  /** Challenge-response flow: initiate, send challenge to device, verify, set network credentials */
  CHAL_RESP: "chal_resp",
} as const;

/**
 * An object containing endpoint paths.
 */
const Endpoint = {
  /** The endpoint for local control. */
  LOCAL_CTRL: "esp_local_ctrl/control",
  /** The endpoint for cloud user association. */
  CLOUD_USER_ASSOCIATION: "cloud_user_assoc",
  /** The endpoint for challenge-response and get-node-id protocol with the device. */
  CHALLENGE_RESPONSE: "ch_resp",
  /** The endpoint for assisted claiming. */
  RM_CLAIM: "rmaker_claim",
};

/**
 * Assisted-claiming REST paths, on the deployment's main API and SigV4-signed
 * like every other `/v1/*` route.
 *
 * Kept out of {@link APIPathV1}: the contract-coverage check validates that const
 * against the committed OpenAPI spec, and these routes are not published there.
 */
const ClaimEndpoints = {
  /** Assigns a node ID to a device MAC. Idempotent per device + caller. */
  CLAIM_INITIATE: "/v1/claim/initiate",
  /** Exchanges a device CSR for a signed certificate. */
  CLAIM_VERIFY: "/v1/claim/verify",
} as const;

/**
 * Additional claim capabilities, passed by the consuming application when
 * calling `startAssistedClaiming`.
 *
 * @enum {string}
 */
enum ClaimCapabilities {
  /** Capability indicating device supports camera claiming with video streaming. */
  CAMERA_CLAIM = "camera_claim",
}

/**
 * Extra IoT policies requested per claim capability, sent as the `capabilities`
 * array on claim/verify and re-supplied on every re-claim or the policies drop.
 *
 * Deliberately empty: `capabilities` is optional, and omitting it attaches no
 * extra policies, which is correct for an ordinary device. Documented values are
 * `s3`, `kvs` and `bridge`; which one a capability needs is a deployment
 * decision, so entries are added only once confirmed.
 */
const ClaimCapabilityPolicies: Partial<
  Record<ClaimCapabilities, readonly string[]>
> = {};

/** Separators accepted in a device MAC address, stripped before sending. */
const CLAIM_MAC_SEPARATORS = /[:.-]/g;

/** Valid MAC lengths after separators are stripped, per the claiming contract. */
const CLAIM_MAC_HEX_LENGTHS = [12, 16] as const;

/**
 * Keys a device may use for its MAC in the claim-start payload, checked in order.
 * The firmware payload is not part of the cloud contract, so several spellings
 * are tolerated.
 */
const CLAIM_DEVICE_MAC_KEYS = [
  "mac_addr",
  "macAddr",
  "mac",
  "MAC",
  "mac_address",
] as const;

/** Keys a device may use for its CSR in the claim payload, checked in order. */
const CLAIM_DEVICE_CSR_KEYS = ["csr", "CSR", "csr_pem"] as const;

/**
 * An object containing error codes related to claiming issues.
 *
 * @enum {string}
 */
const ClaimErrorCodes = {
  /** Error code indicating claiming start failed. */
  CLAIM_START_FAILED: "CLAIM_START_FAILED",
  /** Error code indicating claiming was aborted. */
  CLAIM_ABORTED: "CLAIM_ABORTED",
  /** Error code indicating claiming API call failed. */
  CLAIM_API_FAILED: "CLAIM_API_FAILED",
  /** Error code indicating the claiming service host is not configured yet. */
  CLAIM_API_NOT_CONFIGURED: "CLAIM_API_NOT_CONFIGURED",
  /** Error code indicating the device did not report a usable MAC address. */
  DEVICE_MAC_UNAVAILABLE: "DEVICE_MAC_UNAVAILABLE",
  /** Error code indicating CSR retrieval from the device failed. */
  CSR_RETRIEVAL_FAILED: "CSR_RETRIEVAL_FAILED",
  /** Error code indicating sending the certificate to the device failed. */
  CERTIFICATE_SEND_FAILED: "CERTIFICATE_SEND_FAILED",
  /** Error code indicating the device stopped making progress while streaming the CSR. */
  CSR_STALLED: "CSR_STALLED",
} as const;

/**
 * An object containing claiming progress messages.
 */
const ClaimProgressMessages = {
  /** Message indicating claiming start. */
  CLAIM_STARTING: "Starting assisted claiming...",
  /** Message indicating claim start request sent. */
  CLAIM_START_SENT: "Claim start request sent to device.",
  /** Message indicating device info received from the device. */
  DEVICE_INFO_RECEIVED: "Device info received.",
  /** Message indicating claim init API call. */
  CLAIM_INIT_API: "Sending device info to cloud...",
  /** Message indicating claim init sent to device. */
  CLAIM_INIT_SENT: "Claim init sent to device.",
  /** Message indicating CSR retrieval from the device. */
  CSR_RETRIEVING: "Retrieving CSR from device...",
  /** Message indicating CSR received from the device. */
  CSR_RECEIVED: "CSR received from device.",
  /** Message indicating claim verify API call. */
  CLAIM_VERIFY_API: "Sending CSR to cloud for verification...",
  /** Message indicating the certificate was received from the cloud. */
  CERTIFICATE_RECEIVED: "Certificate received from cloud.",
  /** Message indicating the certificate is being sent to the device. */
  CERTIFICATE_SENDING: "Sending certificate to device...",
  /** Message indicating claiming completed successfully. */
  CLAIM_SUCCESS: "Assisted claiming completed successfully.",
  /** Message indicating claiming failed. */
  CLAIM_FAILED: "Assisted claiming failed.",
} as const;

/**
 * Bounds the CSR retrieval loop, so firmware that reports Success without
 * advancing cannot hang the flow.
 */
const CLAIM_CSR_MAX_CHUNKS = 128;

/**
 * Maximum bytes per claim fragment. A hard ceiling, not a tunable default: the
 * device answers an oversized fragment with `NoMemory`.
 */
const CLAIM_MAX_FRAGMENT_SIZE = 200;

/**
 * An object containing error codes related to provisioning issues.
 *
 * @enum {string}
 */
const ProvErrorCodes = {
  /** Error code indicating the provision type is invalid. */
  INVALID_PROVISION_TYPE: "INVALID_PROVISION_TYPE",
  /** Error code indicating the provisioning adapter is missing. */
  MISSING_PROV_ADAPTER: "MISSING_PROV_ADAPTER",
  /** Error code indicating the node ID is missing. */
  MISSING_NODE_ID: "MISSING_NODE_ID",
  /** Error code indicating the ID token is missing. */
  MISSING_ID_TOKEN: "MISSING_ID_TOKEN",
  /** Error code indicating the provisioning failed. */
  FAILED_PROV: "FAILED_PROV",
  /** Error code indicating the user device association failed. */
  FAILED_USER_DEVICE_ASSOCIATION: "FAILED_USER_DEVICE_ASSOCIATION",
  /** Error code indicating the user node mapping request creation failed. */
  FAILED_USER_NODE_MAPPING_REQUEST_CREATION:
    "FAILED_USER_NODE_MAPPING_REQUEST_CREATION",
  /** Error code indicating the user node mapping cloud timeout. */
  FAILED_USER_NODE_MAPPING_CLOUD_TIMEOUT:
    "FAILED_USER_NODE_MAPPING_CLOUD_TIMEOUT",
  /** Error code indicating the challenge response failed. */
  FAILED_CHALLENGE_RESPONSE: "FAILED_CHALLENGE_RESPONSE",
  /** Error code indicating the mapping response is invalid. */
  INVALID_MAPPING_RESPONSE: "INVALID_MAPPING_RESPONSE",
  /** Error code indicating the device challenge response failed. */
  DEVICE_CHALLENGE_RESPONSE_FAILED: "DEVICE_CHALLENGE_RESPONSE_FAILED",
  /** Error code indicating the challenge response format is invalid. */
  INVALID_CHALLENGE_RESPONSE_FORMAT: "INVALID_CHALLENGE_RESPONSE_FORMAT",
  /** Error code indicating the verify node mapping failed. */
  VERIFY_NODE_MAPPING_FAILED: "VERIFY_NODE_MAPPING_FAILED",
  /** Error code indicating the set network credentials failed. */
  SET_NETWORK_CREDENTIALS_FAILED: "SET_NETWORK_CREDENTIALS_FAILED",
  /** Error code indicating the node did not come online within the timeout. */
  NODE_ONLINE_TIMEOUT: "NODE_ONLINE_TIMEOUT",
} as const;

/**
 * An object containing service types.
 *
 * @enum {string}
 */
const ServiceType = {
  /** Represents the ESP local control TCP service type. */
  ESP_LOCAL_CTRL_TCP: "_esp_local_ctrl._tcp.",
};

/**
 * An object containing protocol types.
 *
 * @enum {string}
 */
const ProtocolType = {
  /** Represents the DNS-SD protocol type. */
  PROTOCOL_DNS_SD: "PROTOCOL_DNS_SD",
};

/**
 * An object containing status messages.
 *
 * @enum {string}
 */
const StatusMessage = {
  /** Represents a success status. */
  SUCCESS: "success",
  /** Represents a confirmed status. */
  CONFIRMED: "confirmed",
  /** Represents a timed out status. */
  TIMEDOUT: "timedout",
};

/** The default REST API version. */
const DEFAULT_REST_API_VERSION = "v1";

/** The SDK version from package.json */
const SDK_VERSION = "1.0.0";

/**
 * An object containing ESP service types.
 *
 * @enum {string}
 */
const ESPServiceType = {
  /** Represents the local control service type. */
  LOCAL_CONTROL: "esp.service.local_control",
};

/**
 * An object containing ESP service parameter types.
 */
const ESPServiceParamType = {
  /** Represents the local control parameter type. */
  LOCAL_CONTROL: {
    /** Represents the type parameter. */
    TYPE: "esp.param.local_control_type",
    /** Represents the POP parameter (SEC-1). */
    POP: "esp.param.local_control_pop",
    /** Represents the username parameter (SEC-2 / SRP6a). */
    USERNAME: "esp.param.local_control_username",
  },
};

/**
 * An object containing ESP provisioning progress messages.
 */
const ESPProvProgressMessages = {
  /** Message indicating the start of user device association. */
  START_ASSOCIATION: "Starting user device association...",
  /** Message indicating the association config request creation. */
  ASSOCIATION_CONFIG_CREATED: "Association config request created.",
  /** Message indicating the sending of association config request. */
  SENDING_ASSOCIATION_CONFIG:
    "Sending association config request to 'cloud_user_assoc' endPoint.",
  /** Message indicating the successful sending of association config request. */
  ASSOCIATION_CONFIG_SENT:
    "Association config request sent successfully to 'cloud_user_assoc' endPoint.",
  /** Message indicating the successful device provisioning. */
  DEVICE_PROVISIONED: "Device provisioned successfully",
  /** Message indicating the successful user node mapping. */
  USER_NODE_MAPPING_SUCCEED: "User node mapping succeed",
  /** Message indicating the decoding of response data. */
  DECODING_RESPONSE_DATA: "Decoding response data",
  /** Message indicating the successful decoding of NodeId from response data. */
  DECODED_NODE_ID: "Decoded NodeId from response data successfully",
  /** Message indicating initiating node association on server. */
  INITIATING_NODE_ASSOCIATION: "Initiating node association...",
  /** Message indicating sending challenge to device. */
  SENDING_CHALLENGE_TO_DEVICE: "Sending challenge to device...",
  /** Message indicating verifying node association on server. */
  VERIFYING_NODE_ASSOCIATION: "Verifying node association...",
  /** Message indicating setting network credentials. */
  SETTING_NETWORK_CREDENTIALS: "Setting network credentials...",
  /** Message indicating waiting for the device to come online after WiFi provisioning. */
  WAITING_FOR_ONLINE: "Waiting for device to come online...",
};

const ErrorLabels = {
  ESPAPICallValidationError: "ESPAPICallValidationError",
  ESPConfigError: "ESPConfigError",
  ESPClaimError: "ESPClaimError",
  ESPProvError: "ESPProvError",
  ESPTokenError: "ESPTokenError",
  ESPStorageAdapterError: "ESPStorageAdapterError",
  ESPValidationError: "ESPValidationError",
};

/**
 * Centralized v1 API path literals and path builder functions.
 * Use these instead of hard-coding path strings to simplify future path changes (e.g. /v1 → /v2).
 */
// Every REST path the SDK can call lives in THIS map — the tracking-coverage
// check (scripts/check-tracking-coverage.mjs) reads it as the source of truth
// for "what the SDK wraps". Add new paths here, never as inline literals.
const APIPathV1 = {
  /** POST /v1/assumed-roles */
  ASSUME_ROLE: "/v1/assumed-roles",
  /** POST /v1/user/credentials (main API, not the user-auth API) */
  USER_CREDENTIALS: "/v1/user/credentials",
  /** GET/POST /v1/groups */
  GROUPS: "/v1/groups",
  /** GET /v1/integrations — list configured integrations (non-admin) */
  INTEGRATIONS: "/v1/integrations",
  /** PUT register endpoint — /v1/integrations/{integrationId}/endpoints */
  integrationEndpoints: (integrationId: string) =>
    `/v1/integrations/${encodeURIComponent(integrationId)}/endpoints`,
  /** DELETE unregister endpoint — /v1/integrations/{integrationId}/endpoints/{endpointId} */
  integrationEndpoint: (integrationId: string, endpointId: string) =>
    `/v1/integrations/${encodeURIComponent(integrationId)}/endpoints/${encodeURIComponent(endpointId)}`,
  /** GET /v1/sharing-requests/received — list sharing requests for the current user */
  SHARING_REQUESTS_RECEIVED: "/v1/sharing-requests/received",
  /** POST /v1/sharing-requests/{requestId}/accept */
  sharingRequestAccept: (requestId: string) =>
    `/v1/sharing-requests/${encodeURIComponent(requestId)}/accept`,
  /** POST /v1/sharing-requests/{requestId}/reject */
  sharingRequestReject: (requestId: string) =>
    `/v1/sharing-requests/${encodeURIComponent(requestId)}/reject`,
  /** POST /v1/user/auth/signup */
  USER_AUTH_SIGNUP: "/v1/user/auth/signup",
  /** POST /v1/user/auth/signup/verify */
  USER_AUTH_SIGNUP_VERIFY: "/v1/user/auth/signup/verify",
  /** POST /v1/user/auth/token */
  USER_AUTH_TOKEN: "/v1/user/auth/token",
  /** POST /v1/user/auth/token/refresh */
  USER_AUTH_TOKEN_REFRESH: "/v1/user/auth/token/refresh",
  /** POST /v1/user/auth/password-recovery */
  USER_AUTH_PASSWORD_RECOVERY: "/v1/user/auth/password-recovery",
  /** POST /v1/user/auth/password-recovery/confirmation */
  USER_AUTH_PASSWORD_RECOVERY_CONFIRMATION:
    "/v1/user/auth/password-recovery/confirmation",
  /** POST /v1/user/auth/password */
  USER_AUTH_PASSWORD: "/v1/user/auth/password",
  /** POST /v1/user/auth/signout */
  USER_AUTH_SIGNOUT: "/v1/user/auth/signout",
  /** GET /v1/users/{userId} — user profile (`me` for the authenticated caller) */
  user: (userId: string) => `/v1/users/${encodeURIComponent(userId)}`,

  /** /v1/groups/{groupId} */
  group: (groupId: string) => `/v1/groups/${groupId}`,
  /** /v1/groups/{groupId}/node-assoc-requests */
  groupNodeAssocRequests: (groupId: string) =>
    `/v1/groups/${groupId}/node-assoc-requests`,
  /** /v1/groups/{groupId}/node-assoc-requests/{requestId}/verify - Challenge_response (traditional) or nocsr_elements (Matter) */
  groupNodeAssocVerify: (groupId: string, requestId: string) =>
    `/v1/groups/${groupId}/node-assoc-requests/${requestId}/verify`,
  /** POST /v1/groups/{groupId}/node-assoc-requests/{requestId}/confirm - Confirms user-node mapping (Matter commissioning) */
  groupNodeAssocConfirm: (groupId: string, requestId: string) =>
    `/v1/groups/${groupId}/node-assoc-requests/${requestId}/confirm`,
  /** /v1/groups/{groupId}/subgroups */
  groupSubgroups: (groupId: string) => `/v1/groups/${groupId}/subgroups`,
  /** /v1/groups/{groupId}/subgroups/{subgroupId} */
  groupSubgroup: (groupId: string, subgroupId: string) =>
    `/v1/groups/${groupId}/subgroups/${subgroupId}`,
  /** /v1/groups/{groupId}/subgroups/{subgroupId}/sharing-requests */
  groupSubgroupSharingRequests: (groupId: string, subgroupId: string) =>
    `/v1/groups/${groupId}/subgroups/${subgroupId}/sharing-requests`,
  /** /v1/groups/{groupId}/subgroups/{subgroupId}/nodes/{nodeId} */
  groupSubgroupNode: (groupId: string, subgroupId: string, nodeId: string) =>
    `/v1/groups/${groupId}/subgroups/${subgroupId}/nodes/${nodeId}`,
  /** /v1/groups/{groupId}/sharing-requests */
  groupSharingRequests: (groupId: string) =>
    `/v1/groups/${groupId}/sharing-requests`,
  /** GET /v1/groups/{groupId}/users — list users with access to the group */
  groupUsers: (groupId: string) => `/v1/groups/${groupId}/users`,
  /** /v1/groups/{groupId}/users/{userId} - Remove member (use 'me' to leave) */
  groupUser: (groupId: string, userId: string) =>
    `/v1/groups/${groupId}/users/${userId}`,
  /** GET /v1/groups/{groupId}/subgroups/{subgroupId}/users — list users with access to the subgroup */
  groupSubgroupUsers: (groupId: string, subgroupId: string) =>
    `/v1/groups/${groupId}/subgroups/${subgroupId}/users`,
  /** /v1/groups/{groupId}/subgroups/{subgroupId}/users/{userId} - Remove member (use 'me' to leave) */
  groupSubgroupUser: (groupId: string, subgroupId: string, userId: string) =>
    `/v1/groups/${groupId}/subgroups/${subgroupId}/users/${userId}`,
  /** DELETE /v1/groups/{groupId}/nodes/{nodeId} - Remove node from group (disassociation) */
  groupNode: (groupId: string, nodeId: string) =>
    `/v1/groups/${groupId}/nodes/${nodeId}`,
  /** /v1/groups/{groupId}/nodes/{nodeId}/config */
  groupNodeConfig: (groupId: string, nodeId: string) =>
    `/v1/groups/${groupId}/nodes/${nodeId}/config`,
  /** /v1/groups/{groupId}/nodes/{nodeId}/triggers */
  groupNodeTriggers: (groupId: string, nodeId: string) =>
    `/v1/groups/${groupId}/nodes/${nodeId}/triggers`,
  /** /v1/groups/{groupId}/nodes/{nodeId}/schedules */
  groupNodeSchedules: (groupId: string, nodeId: string) =>
    `/v1/groups/${groupId}/nodes/${nodeId}/schedules`,
  /** /v1/groups/{groupId}/nodes/{nodeId}/timeseries/raw */
  groupNodeTimeseriesRaw: (groupId: string, nodeId: string) =>
    `/v1/groups/${groupId}/nodes/${nodeId}/timeseries/raw`,
  /** /v1/groups/{groupId}/nodes/{nodeId}/timeseries/latest */
  groupNodeTimeseriesLatest: (groupId: string, nodeId: string) =>
    `/v1/groups/${groupId}/nodes/${nodeId}/timeseries/latest`,
  /** /v1/groups/{groupId}/nodes/{nodeId}/timeseries/aggregates */
  groupNodeTimeseriesAggregates: (groupId: string, nodeId: string) =>
    `/v1/groups/${groupId}/nodes/${nodeId}/timeseries/aggregates`,
  /** /v1/groups/{groupId}/service/automations */
  groupAutomation: (groupId: string) =>
    `/v1/groups/${groupId}/service/automations`,
  /** /v1/groups/{groupId}/service/automations/{automationId} */
  groupAutomationId: (groupId: string, automationId: string) =>
    `/v1/groups/${groupId}/service/automations/${automationId}`,
  /** POST /v1/groups/{groupId}/node-assoc-requests - Initiates user node mapping */
  USER_NODE_MAPPING_INITIATE: (groupId: string) =>
    `/v1/groups/${groupId}/node-assoc-requests`,
  /** POST /v1/groups/{groupId}/node-assoc-requests/{requestId}/verify - Verifies user node mapping */
  USER_NODE_MAPPING_VERIFY: (groupId: string, requestId: string) =>
    `/v1/groups/${groupId}/node-assoc-requests/${requestId}/verify`,
} as const;

export {
  HTTPMethods,
  APIEndpoints,
  APIPathV1,
  StorageKeys,
  ValidationErrorCodes,
  StorageAdapterErrorCodes,
  ConfigErrorCodes,
  APICallValidationErrorCodes,
  APIOperations,
  TokenErrorCodes,
  AuthErrorCodes,
  AuthSuccessMessages,
  AutomationSuccessMessages,
  AutomationStatusValues,
  GroupSuccessMessages,
  NodeSuccessMessages,
  NodeWarnMessages,
  ScheduleSuccessMessages,
  ScheduleErrorMessages,
  TriggerErrorMessages,
  TriggerSuccessMessages,
  SharingSuccessMessages,
  IntegrationSuccessMessages,
  AssumeRoleErrorMessages,
  AWSCredentialsErrorMessages,
  GroupUserAliases,
  Endpoint,
  ProvisionType,
  ProvErrorCodes,
  ServiceType,
  ProtocolType,
  StatusMessage,
  DEFAULT_REST_API_VERSION,
  ESPServiceType,
  ESPServiceParamType,
  ESPProvProgressMessages,
  ErrorLabels,
  SDK_VERSION,
  ClaimEndpoints,
  ClaimCapabilities,
  ClaimCapabilityPolicies,
  ClaimErrorCodes,
  ClaimProgressMessages,
  CLAIM_CSR_MAX_CHUNKS,
  CLAIM_MAX_FRAGMENT_SIZE,
  CLAIM_MAC_SEPARATORS,
  CLAIM_MAC_HEX_LENGTHS,
  CLAIM_DEVICE_MAC_KEYS,
  CLAIM_DEVICE_CSR_KEYS,
};

export enum ESPRMNeoErrorCodes {
  SDK_NOT_CONFIGURED = "SDK_NOT_CONFIGURED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  USER_NOT_CONFIRMED = "USER_NOT_CONFIRMED",
  USER_NOT_FOUND = "USER_NOT_FOUND",
}

export enum ESPRMNeoStorageKeys {
  ACCESS_TOKEN = "ESPRMNeo_ACCESS_TOKEN",
  ID_TOKEN = "ESPRMNeo_ID_TOKEN",
  REFRESH_TOKEN = "ESPRMNeo_REFRESH_TOKEN",
}

/**
 * Stable identifier(s) for subscription channels that this SDK ships and
 * registers with the {@link ESPRMNeoSubscriptionManager}.
 *
 * Only channels shipped by this SDK are listed here. External channel
 * implementations define and own their own channel ids.
 */
export const SubscriptionChannelIds = {
  /** MQTT (AWS IoT Device Shadow) channel — shipped by the base Neo SDK. */
  MQTT: "mqtt",
} as const;
