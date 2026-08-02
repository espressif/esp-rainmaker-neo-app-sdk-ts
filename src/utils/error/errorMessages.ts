/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Contains error messages related to configuration issues.
 *
 * These messages are used to provide descriptive errors when
 * configuration validations fail in the ESPRMAuth instance.
 */
const configErrorMessages = {
  /** Error message indicating that the SDK is not initialized. */
  SDK_NOT_CONFIGURED: "ESPRMNeoBase is not initialized yet",
  /** Error message indicating that the config must be a non-null object. */
  INVALID_CONFIG_OBJECT:
    "Configuration Error: Config must be a non-null object.",
  /** Error message indicating that the base URL is invalid or empty. */
  INVALID_BASE_URL:
    "Configuration Error: BaseUrl must be a non-empty valid URL string.",
  /** Error message indicating that the transport mode is invalid. */
  INVALID_TRANSPORT_MODE:
    "Configuration Error: Invalid transport mode. Please provide a valid transport mode",
  /** Error message indicating that the transport order is empty or not an array. */
  INVALID_TRANSPORT_ORDER: "Transport order must be a non-empty array",
  /** Error message indicating that the AWS region is required. */
  INVALID_REGION:
    "Configuration Error: AWS region is required and cannot be empty.",
  /** Error message indicating that an invalid storage adapter was provided. */
  INVALID_STORAGE_ADAPTER:
    "Configuration Error: Invalid storage adapter provided.",
  /** Error message indicating that an invalid MQTT adapter was provided. */
  INVALID_MQTT_ADAPTER: "Configuration Error: Invalid MQTT adapter provided.",
  /** Error message indicating that the IoT endpoint is missing or empty. */
  INVALID_IOT_ENDPOINT:
    "Configuration Error: IoT endpoint is required and cannot be empty.",
  /** Error message indicating that an invalid provisioning adapter was provided. */
  INVALID_PROVISION_ADAPTER:
    "Configuration Error: Invalid provisioning adapter provided.",
  /** Error message indicating that an invalid local control adapter was provided. */
  INVALID_LOCAL_CONTROL_ADAPTER:
    "Configuration Error: Invalid local control adapter provided.",
  /** Error message indicating that an invalid local discovery adapter was provided. */
  INVALID_LOCAL_DISCOVERY_ADAPTER:
    "Configuration Error: Invalid local discovery adapter provided.",
  /** Error message indicating that the User/auth API base URL is missing or empty. */
  INVALID_USER_API_BASE:
    "Configuration Error: UserApiBase must be a non-empty valid URL string.",
};

/**
 * Contains validation error messages for user authentication.
 *
 * These messages are used to inform users about missing or invalid
 * parameters during the authentication process.
 */
const validationErrorMessages = {
  /** Error message indicating that the password is required. */
  MISSING_LOGIN_PASSWORD: "Validation Error: Password is required.",
};

/**
 * Contains error messages related to storage adapter issues.
 *
 * These messages inform users about potential issues with storage
 * adapter configurations, especially in unsupported environments.
 */
const storageAdapterErrorMessages = {
  /** Error message indicating that the default storage adapter API is unsupported. */
  UNSUPPORTED_DEFAULT_STORAGE_ADAPTER_API:
    "ESPStorageAdapterError: It seems like your environment doesn't support window.localstorage, you can define your own storage adapter while configuring the ESPRMAuth instance. Please refer docs for more information.",
};

/**
 * Contains validation error messages for API calls.
 *
 * These messages are used to inform users when required API parameters
 * are missing or invalid.
 */
const apiCallValidationErrorMessages = {
  /** Error message indicating that the group ID is missing. */
  MISSING_GROUP_ID: "ESPAPICallValidationError: Group ID is required.",
  /** Error message indicating that the group name is missing. */
  MISSING_GROUP_NAME: "ESPAPICallValidationError: Group Name is required.",
  /** Error message indicating that the node list is missing. */
  MISSING_NODE_LIST: "ESPAPICallValidationError: Node list is required.",
  /** Error message indicating that the node ID is missing. */
  MISSING_NODE_ID: "ESPAPICallValidationError: Node ID is required.",
  /** Error message indicating that the parent node reference has been garbage collected. */
  MISSING_NODE_REF:
    "ESPAPICallValidationError: Node reference has been garbage collected",
  /** Error message indicating that the secret key is missing. */
  MISSING_SECRET_KEY: "ESPAPICallValidationError: Secret key is required.",
  /** Error message indicating that update information for the group is missing. */
  MISSING_GROUP_UPDATE_INFO:
    "ESPAPICallValidationError: Missing update information for the group.",
  /** Error message indicating that device token or endpoint is missing for delete endpoint operation. */
  MISSING_DELETE_ENDPOINT_PARAMS:
    "ESPAPICallValidationError: Missing deviceToken or endpoint. Please provide any one of them to delete endpoint",
  /** Error message indicating that a device list refresh is required. */
  DEVICE_LIST_REFRESH_REQUIRED:
    "ESPAPICallValidationError: Please refresh the device list.",
  /** Error message indicating that a node is unreachable. */
  NODE_UNREACHABLE:
    "ESPAPICallValidationError: Node is unreachable. Please check the connection.",
  /** Error message indicating that a event type is invalid. */
  INVALID_EVENT_TYPE:
    "ESPAPICallValidationError: Invalid event type. Please provide a valid event type.",
  /** Error message indicating that the base URL is missing. */
  MISSING_BASE_URL: "ESPAPICallValidationError: Base URL is required.",
  /** Error message indicating that the automation action index is invalid. */
  INVALID_ACTION_INDEX:
    "ESPAPICallValidationError: Invalid action index. Please provide a valid action index.",
  /** Error message indicating that the automation ID is missing. */
  MISSING_AUTOMATION_ID:
    "ESPAPICallValidationError: Automation ID is required.",
  /** Error message indicating that the automation name is missing. */
  MISSING_AUTOMATION_NAME:
    "ESPAPICallValidationError: Automation name is required.",
  /** Error message indicating that the automation conditions are missing. */
  MISSING_AUTOMATION_CONDITIONS:
    "ESPAPICallValidationError: Automation conditions are required.",
  /** Error message indicating that the automation actions are missing. */
  MISSING_AUTOMATION_ACTIONS:
    "ESPAPICallValidationError: Automation actions are required.",
  /** Error message indicating setParams was called with an empty or missing params object. */
  MISSING_PARAMS:
    "ESPAPICallValidationError: setParams requires a non-empty params object.",
  /** Error message indicating that the trigger item is missing or invalid. */
  MISSING_TRIGGER: "ESPAPICallValidationError: Trigger is required.",
  /** Error message indicating that the trigger ID is missing or empty. */
  MISSING_TRIGGER_ID: "ESPAPICallValidationError: Trigger ID is required.",
  /** Error message indicating that a trigger with the same id already exists. */
  TRIGGER_ALREADY_EXISTS:
    "ESPAPICallValidationError: A trigger with this id already exists on the node.",

  /** Error message indicating that the action target is invalid or missing required fields. */
  INVALID_ACTION_TARGET:
    "ESPAPICallValidationError: Action target must have node and path (<deviceId>.<paramId>).",
  /** Error message indicating that options.dataType is missing for a custom time-series key. */
  MISSING_TS_CUSTOM_KEY_DATA_TYPE:
    "ESPAPICallValidationError: options.key requires options.dataType (the node config carries no data type for custom keys).",
  /** Error message indicating that the time-series param carries no data type. */
  MISSING_TS_DATA_TYPE:
    "ESPAPICallValidationError: Param has no data_type; pass options.dataType explicitly.",
  /** Error message indicating that the time-series param was not found on the node's config. */
  TS_PARAM_NOT_FOUND:
    "ESPAPICallValidationError: Param not found on the node's config.",
  /** Error message indicating that startTs is missing for a raw time-series query. */
  MISSING_TS_START_TIME:
    "ESPAPICallValidationError: options.startTs (Unix timestamp in ms) is required for raw time-series queries.",
  /** Error message indicating that the time-series aggregation window is missing or invalid. */
  INVALID_TS_WINDOW:
    "ESPAPICallValidationError: options.window is required for aggregate time-series queries (one of: hourly, daily, weekly, monthly).",
  /** Error message indicating that the schedule item is missing or invalid. */
  MISSING_SCHEDULE: "ESPAPICallValidationError: Schedule is required.",
  /** Error message indicating that the schedule id is missing or empty. */
  MISSING_SCHEDULE_ID:
    "ESPAPICallValidationError: Schedule id is required and must be a non-empty string.",
  /** Error message indicating that the schedules argument is not an array. */
  INVALID_SCHEDULES: "ESPAPICallValidationError: Schedules must be an array.",
  /** Error message indicating that the nodeSchedules argument is not an array. */
  INVALID_NODE_SCHEDULES:
    "ESPAPICallValidationError: nodeSchedules must be an array.",
  /** Error message indicating that schedule.enabled is missing or not a boolean. */
  INVALID_SCHEDULE_ENABLED:
    "ESPAPICallValidationError: Schedule enabled is required and must be a boolean.",
  /** Error message indicating that schedule.triggers is missing or not an array. */
  INVALID_SCHEDULE_TRIGGERS:
    "ESPAPICallValidationError: Schedule triggers is required and must be an array.",
  /** Error message indicating that schedule.action is missing or not an object. */
  INVALID_SCHEDULE_ACTION:
    "ESPAPICallValidationError: Schedule action is required and must be an object.",
  /** Error message indicating that a schedule with the same id already exists. */
  SCHEDULE_ALREADY_EXISTS:
    "ESPAPICallValidationError: A schedule with this id already exists on the node.",
  /** Error message indicating that the schedule was not found on the node. */
  SCHEDULE_NOT_FOUND:
    "ESPAPICallValidationError: Schedule not found on the node.",
  /** Error message indicating that the trigger was not found on the node. */
  TRIGGER_NOT_FOUND:
    "ESPAPICallValidationError: Trigger not found on the node.",
  /** Error message indicating that the schedule's node could not be resolved. */
  SCHEDULE_NODE_NOT_FOUND:
    "ESPAPICallValidationError: Schedule node not found in the group.",
  /** Error message indicating addNode was called on a root group. */
  ADD_NODE_REQUIRES_NESTED_GROUP:
    "ESPAPICallValidationError: addNode is only supported on nested groups (parentId set).",
  /** Error message indicating the node is already in the group. */
  NODE_ALREADY_IN_GROUP:
    "ESPAPICallValidationError: Node is already in this group.",
  /** Error message indicating the node config could not be resolved. */
  NODE_CONFIG_UNRESOLVED:
    "ESPAPICallValidationError: Node config could not be resolved.",
  /** Error message indicating the user ID is missing. */
  MISSING_USER_ID: "ESPAPICallValidationError: User ID is required.",
  /** Error message indicating the username is missing for group sharing. */
  MISSING_USERNAME:
    "ESPAPICallValidationError: Username is required for sharing.",
  /** Error message indicating removeMember was called with the current-user alias. */
  USE_LEAVE_FOR_CURRENT_USER:
    "ESPAPICallValidationError: Use group.leave() to remove the current user from a group.",
};

/**
 * Contains error messages related to token access issues.
 *
 * These messages are used to inform users when there is a problem with
 * the authentication tokens.
 */
const tokenErrorMessages = {
  /** Error message indicating that the access token is missing. */
  MISSING_ACCESS_TOKEN:
    "ESPTokenError: Access token is missing. User needs to authenticate.",
  /** Error message indicating that the ID token is missing. */
  MISSING_ID_TOKEN: "ESPTokenError: Missing ID token - user must be logged in",
  /** Error message indicating that the refresh token is missing. */
  MISSING_REFRESH_TOKEN:
    "ESPTokenError: Refresh token is missing. Cannot renew access token.",
  /** Error message indicating that extending the session failed. */
  EXTEND_SESSION_FAILED: "ESPTokenError: Unable to extend session",
};

/**
 * Contains error messages related to authentication operations.
 */
const authErrorMessages = {
  /** Error message indicating that the user is not logged in. */
  NOT_LOGGED_IN:
    "Not logged in — id and access tokens are required to change the password",
  /** Fallback message when password recovery initiation fails without an Error. */
  FORGOT_PASSWORD_FAILED: "Password recovery request failed",
  /** Fallback message when loading the logged-in user fails without an Error. */
  GET_LOGGED_IN_USER_FAILED: "Failed to load logged-in user",
  /** Error message when login response is missing required tokens. */
  LOGIN_FAILED_MISSING_TOKENS: "Authentication failed: Missing required tokens",
  /** Fallback message when login fails without an Error. */
  LOGIN_FAILED: "Authentication failed",
  /** Invalid username/password message. */
  INVALID_CREDENTIALS: "Invalid username or password",
  /** User not found message. */
  USER_NOT_FOUND: "User not found",
  /** Error message when token refresh response is missing required tokens. */
  TOKEN_REFRESH_FAILED_MISSING_TOKENS:
    "Failed to refresh session: Missing required tokens",
  /** Error message when OTP verification returns no authentication result. */
  OTP_NO_AUTH_RESULT:
    "Authentication failed: No authentication result received",
  /** Error message when OTP request returns no session token. */
  OTP_SESSION_TOKEN_FAILED: "Failed to get session token",
  /** Fallback message when sign-up code request fails without an Error. */
  SIGNUP_FAILED: "Sign-up code request failed",
  /** Fallback message when sign-up confirmation fails without an Error. */
  CONFIRM_SIGNUP_FAILED: "Sign-up confirmation failed",
  /** Fallback message when password change fails without an Error. */
  CHANGE_PASSWORD_FAILED: "Password change failed",
  /** Fallback message when password reset confirmation fails without an Error. */
  PASSWORD_RESET_FAILED: "Password reset failed",
};

/**
 * Contains provisioning-related error messages.
 *
 * These messages are used to inform users about issues during the
 * device provisioning process.
 */
const provErrorMessages = {
  /** Error message indicating that the provisioning adapter is missing. */
  MISSING_PROV_ADAPTER:
    "ESPProvError: Provisioning adapter is missing. Please set provision adapter using setProvisioningAdapter method first",
  /** Error message indicating that the node ID is missing. */
  MISSING_NODE_ID: "ESPProvError: Failed to get nodeId.",
  /** Error message indicating that the ID token is missing. */
  MISSING_ID_TOKEN: "ESPProvError: Failed to fetch Id token",
  /** Error message indicating that device provisioning failed. */
  FAILED_PROV: "ESPProvError: Failed device provisioning",
  /** Error message indicating that user device association failed. */
  FAILED_USER_DEVICE_ASSOCIATION:
    "ESPProvError: Failed user device association",
  /** Error message indicating that creating a user node mapping request failed due to network issues. */
  FAILED_USER_NODE_MAPPING_REQUEST_CREATION:
    "ESPProvError: Failed to create user node mapping request due to some network failure",
  /** Error message indicating that the user device mapping cloud operation timed out. */
  FAILED_USER_NODE_MAPPING_CLOUD_TIMEOUT:
    "ESPProvError: Timed out user device mapping on cloud",
  /** Error message indicating that the device did not come online within the timeout. */
  NODE_ONLINE_TIMEOUT:
    "ESPProvError: Timed out waiting for device to come online",
  /** Error message indicating that an unsupported provisioning type was requested. */
  INVALID_PROVISION_TYPE:
    "ESPProvError: Invalid or unsupported provisioning type",
  /** Error message indicating that the node mapping response was malformed. */
  INVALID_MAPPING_RESPONSE:
    "ESPProvError: Node mapping response is missing challenge or request id",
  /** Error message indicating that the challenge response from the device was malformed. */
  INVALID_CHALLENGE_RESPONSE_FORMAT:
    "ESPProvError: Device returned an invalid challenge response",
};

/**
 * An object containing error messages related to claiming issues.
 */
const claimErrorMessages = {
  /** Error message indicating that the claiming process failed to start. */
  CLAIM_START_FAILED:
    "ESPClaimError: Failed to start the claiming process. Please check device connection and try again.",
  /** Error message indicating that the claiming process was aborted. */
  CLAIM_ABORTED: "ESPClaimError: Claiming process was aborted.",
  /** Error message indicating that the claiming API call failed. */
  CLAIM_API_FAILED: "ESPClaimError: Failed to communicate with claiming API.",
  /** Error message indicating that the claiming API is unavailable. */
  CLAIM_API_NOT_CONFIGURED:
    "ESPClaimError: Claiming API is unavailable because the SDK is not configured. Ensure `ESPRMNeoBase.configure()` ran first.",
  /** Error message indicating that the device did not report a usable MAC address. */
  DEVICE_MAC_UNAVAILABLE:
    "ESPClaimError: Device did not report a MAC address in its claim start response, which the claiming service requires.",
  /** Error message indicating that CSR retrieval from the device failed. */
  CSR_RETRIEVAL_FAILED:
    "ESPClaimError: Failed to retrieve CSR (Certificate Signing Request) from device.",
  /** Error message indicating that sending the certificate to the device failed. */
  CERTIFICATE_SEND_FAILED:
    "ESPClaimError: Failed to send certificate to device.",
  /** Error message indicating that the device stopped advancing the CSR stream. */
  CSR_STALLED:
    "ESPClaimError: Device stopped sending CSR data before it was complete.",
};

const defaultErrorMessages = {
  /** Error message indicating that an unknown error occurred. */
  UNKNOWN_ERROR: "An unknown error occurred.",
  /** Error message indicating that an unknown error occurred during configuration. */
  CONFIGURATION_ERROR: "An unknown error occurred while configuring.",
  /** Error message indicating that an unknown error occurred during provision. */
  PROVISION_ERROR: "An unknown error occurred while provisioning.",
  /** Error message indicating that an unknown error occurred during claiming. */
  CLAIM_ERROR: "An unknown error occurred while claiming device.",
  API_ERROR: "An error occurred while making the API request",
  CONFIG_ERROR: "An error occurred in the configuration",
  VALIDATION_ERROR: "An error occurred in the validation",
  STORAGE_ERROR: "An error occurred in the storage",
  TOKEN_ERROR: "An error occurred in the token",
  STORAGE_ADAPTER_ERROR: "An error occurred in the storage adapter",
};

export {
  configErrorMessages,
  validationErrorMessages,
  storageAdapterErrorMessages,
  apiCallValidationErrorMessages,
  tokenErrorMessages,
  authErrorMessages,
  provErrorMessages,
  claimErrorMessages,
  defaultErrorMessages,
};
