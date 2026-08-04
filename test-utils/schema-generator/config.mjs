/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Schema generation config.
 *
 * `specs` lists every spec document the generator processes — OpenAPI (REST)
 * and AsyncAPI (MQTT/push; `format: "asyncapi"`).  Each entry
 * has two sections:
 *
 *   operations   — the endpoints the SDK wraps; used ONLY for operation-level
 *                  contract drift detection (`npm run contracts:drift-check`).
 *                  Add an entry when a new endpoint is covered by the SDK.
 *
 *   exportedSchemas — named component schemas to include in the AJV runtime
 *                  bundle (`contracts/openapi/generated/schemas.json`).
 *                  These are the schema names passed to `validated()` in tests.
 *                  Add a name when a new schema is needed in tests.
 *
 * Per-operation fields:
 *   method      HTTP verb (lowercase)
 *   path        path as in the spec (e.g. "/v1/groups/{groupId}")
 *   statuses    response status codes to fingerprint
 *   requestBody whether to fingerprint the request body schema too
 *   responseSchemas  optional { "<status>": "<bundleName>" } map — exports a
 *                    response schema the spec defines INLINE on the operation
 *                    (no named component) under a stable bundle name for
 *                    `validated()` / `assertValidSchema()` call sites.
 */

export const specs = [
  {
    specFile: "Api_Swagger.yaml",
    operations: [
      { method: "post", path: "/v1/groups",                                    statuses: ["201"], requestBody: true  },
      { method: "post", path: "/v1/assumed-roles",                             statuses: ["200"], requestBody: false },
      { method: "post", path: "/v1/user/credentials",                          statuses: ["200"], requestBody: false },
      { method: "get",  path: "/v1/groups",                                    statuses: ["200"], requestBody: false },
      { method: "get",  path: "/v1/groups/{groupId}/users",                    statuses: ["200"], requestBody: false },
      { method: "post", path: "/v1/groups/{groupId}/sharing-requests",         statuses: ["201", "400"], requestBody: true,
        responseSchemas: { 201: "CreateSharingRequestResponse" } },
      { method: "get",  path: "/v1/sharing-requests/received",                 statuses: ["200"], requestBody: false },
      { method: "post", path: "/v1/sharing-requests/{requestId}/accept",       statuses: ["200"], requestBody: false },
      { method: "post", path: "/v1/sharing-requests/{requestId}/reject",       statuses: ["200"], requestBody: false },
      // ── Added by the coverage sweep (every APIPathV1 path is tracked) ──
      { method: "patch",  path: "/v1/groups/{groupId}",                                            statuses: ["200"], requestBody: true  },
      { method: "delete", path: "/v1/groups/{groupId}",                                            statuses: ["200"], requestBody: false },
      { method: "post",   path: "/v1/groups/{groupId}/node-assoc-requests",                        statuses: ["201"], requestBody: false },
      { method: "post",   path: "/v1/groups/{groupId}/node-assoc-requests/{requestId}/verify",     statuses: ["200"], requestBody: true  },
      { method: "post",   path: "/v1/groups/{groupId}/node-assoc-requests/{requestId}/confirm",    statuses: ["200"], requestBody: true  },
      { method: "post",   path: "/v1/groups/{groupId}/subgroups",                                  statuses: ["201"], requestBody: true  },
      { method: "patch",  path: "/v1/groups/{groupId}/subgroups/{subGroupId}",                     statuses: ["200"], requestBody: true  },
      { method: "delete", path: "/v1/groups/{groupId}/subgroups/{subGroupId}",                     statuses: ["200"], requestBody: false },
      { method: "post",   path: "/v1/groups/{groupId}/subgroups/{subGroupId}/sharing-requests",    statuses: ["201"], requestBody: true  },
      { method: "put",    path: "/v1/groups/{groupId}/subgroups/{subGroupId}/nodes/{nodeId}",      statuses: ["200"], requestBody: false },
      { method: "delete", path: "/v1/groups/{groupId}/subgroups/{subGroupId}/nodes/{nodeId}",      statuses: ["200"], requestBody: false },
      { method: "delete", path: "/v1/groups/{groupId}/users/{userId}",                             statuses: ["200"], requestBody: false },
      { method: "delete", path: "/v1/groups/{groupId}/subgroups/{subGroupId}/users/{userId}",      statuses: ["200"], requestBody: false },
      { method: "delete", path: "/v1/groups/{groupId}/nodes/{nodeId}",                             statuses: ["200"], requestBody: false },
      // node config: spec documents no 2xx for PUT/DELETE, so only GET is fingerprintable
      { method: "get",    path: "/v1/groups/{groupId}/nodes/{nodeId}/config",                      statuses: ["200"], requestBody: false },
      { method: "get",    path: "/v1/groups/{groupId}/nodes/{nodeId}/triggers",                    statuses: ["200"], requestBody: false },
      { method: "put",    path: "/v1/groups/{groupId}/nodes/{nodeId}/triggers",                    statuses: ["200"], requestBody: true  },
      { method: "delete", path: "/v1/groups/{groupId}/nodes/{nodeId}/triggers",                    statuses: ["200"], requestBody: false },
      { method: "get",    path: "/v1/groups/{groupId}/nodes/{nodeId}/schedules",                   statuses: ["200"], requestBody: false },
      { method: "put",    path: "/v1/groups/{groupId}/nodes/{nodeId}/schedules",                   statuses: ["200"], requestBody: true  },
      { method: "delete", path: "/v1/groups/{groupId}/nodes/{nodeId}/schedules",                   statuses: ["200"], requestBody: false },
      { method: "get",    path: "/v1/groups/{groupId}/service/automations",                        statuses: ["200"], requestBody: false },
      { method: "post",   path: "/v1/groups/{groupId}/service/automations",                        statuses: ["200"], requestBody: true  },
      { method: "delete", path: "/v1/groups/{groupId}/service/automations",                        statuses: ["200"], requestBody: false },
      { method: "get",    path: "/v1/groups/{groupId}/service/automations/{automationId}",         statuses: ["200"], requestBody: false },
      { method: "put",    path: "/v1/groups/{groupId}/service/automations/{automationId}",         statuses: ["200"], requestBody: true  },
      { method: "delete", path: "/v1/groups/{groupId}/service/automations/{automationId}",         statuses: ["200"], requestBody: false },
      // ── Post-merge sweep (version-1): integrations, time series,
      //    and subgroup user listing added by the SDK rewrite ──
      { method: "get",    path: "/v1/groups/{groupId}/subgroups/{subGroupId}/users",               statuses: ["200"], requestBody: false },
      { method: "get",    path: "/v1/integrations",                                                statuses: ["200"], requestBody: false },
      { method: "put",    path: "/v1/integrations/{integrationId}/endpoints",                      statuses: ["200"], requestBody: true  },
      { method: "delete", path: "/v1/integrations/{integrationId}/endpoints/{endpointId}",         statuses: ["200"], requestBody: false },
      { method: "get",    path: "/v1/groups/{groupId}/nodes/{nodeId}/timeseries/raw",              statuses: ["200"], requestBody: false },
      { method: "get",    path: "/v1/groups/{groupId}/nodes/{nodeId}/timeseries/latest",           statuses: ["200"], requestBody: false },
      { method: "get",    path: "/v1/groups/{groupId}/nodes/{nodeId}/timeseries/aggregates",       statuses: ["200"], requestBody: false },
    ],
    exportedSchemas: [
      "CreateGroupRequest",
      "CreateGroupResponse",
      "AssumeRoleResponse",
      "UserCredsResponse",
      "ListGroupsResponse",
      "GroupInfo",
      "SubGroupInfo",
      "NodeCapabilityInfo",
      "ListGroupUsersResponse",
      "GroupUserInfo",
      "ListSharingRequestsResponse",
      "SharingRequestInfo",
      "CreateSharingRequestRequest",
      // CreateSharingRequestResponse was inlined into the operation's 201
      // response upstream — no named component to export anymore.
      "APIStatusMessage",
      "SuccessResponse",
      "CreateSubgroupResponse",
      // Node config
      "NodeConfig",
      // Error responses — both specs define `Error`, with different
      // shapes, so they export under aliases. Use with validatedError().
      { name: "Error", as: "ApiError" },
      // Automation
      "Automation",
      "AutomationPayload",
      "AutomationWriteResponse",
      "ListAutomationsResponse",
      // Integrations
      "ListPublicIntegrationsResponse",
      "RegisterEndpointRequest",
      "RegisterEndpointResponse",
      // Node time series
      "TimeseriesRawDataResponse",
      "TimeseriesLatestDataResponse",
      "TimeseriesAggregatesResponse",
    ],
  },
  {
    specFile: "User_Api_Swagger.yaml",
    operations: [
      { method: "post", path: "/v1/user/auth/token",                           statuses: ["200"], requestBody: true  },
      { method: "post", path: "/v1/user/auth/signup",                          statuses: ["201"], requestBody: true,
        responseSchemas: { 201: "SignupResponse" } },
      { method: "post", path: "/v1/user/auth/signup/verify",                   statuses: ["200"], requestBody: true  },
      { method: "post", path: "/v1/user/auth/password-recovery",               statuses: ["200"], requestBody: true  },
      { method: "post", path: "/v1/user/auth/password-recovery/confirmation",  statuses: ["200"], requestBody: true  },
      { method: "post", path: "/v1/user/auth/password",                        statuses: ["200"], requestBody: true  },
      { method: "post", path: "/v1/user/auth/token/refresh",                   statuses: ["200"], requestBody: true  },
      { method: "post", path: "/v1/user/auth/signout",                          statuses: ["200"], requestBody: true  },
      { method: "get",  path: "/v1/users/{userId}",                             statuses: ["200"], requestBody: false },
    ],
    exportedSchemas: [
      // The user auth surface was reshaped upstream around OAuth2/OIDC.
      // The legacy /v1/user/auth/* endpoints survive but their schemas were
      // renamed — aliases keep the exported bundle keys (and every test
      // call site) stable while validating against the new contract.
      { name: "LegacyTokenRequest", as: "SigninRequest" },
      { name: "TokenSet", as: "SigninResponse" },
      { name: "LegacySignupRequest", as: "SignupRequest" },
      // Success responses of signup/verify, password-recovery(+confirmation),
      // password change and signout now all $ref the generic Error envelope
      // ({message}) in the spec; export it under the operation-shaped names
      // the tests validate against.
      { name: "Error", as: "VerifySignupResponse" },
      { name: "Error", as: "ForgotPasswordResponse" },
      { name: "Error", as: "ChangePasswordResponse" },
      // SignupResponse, VerifySignupRequest, ForgotPasswordRequest,
      // ConfirmForgotPasswordRequest and ChangePasswordRequest were inlined
      // into their operations upstream — no named components to export.
      // User profile
      "GetUserResponse",
      // Error responses
      { name: "Error", as: "UserApiError" },
    ],
  },
  {
    specFile: "MQTT_User.yaml",
    format: "asyncapi",
    // Bundle key prefix: schemas land as `mqtt:<messageName>`.
    messagePrefix: "mqtt",
    // Message payloads to export + fingerprint (channels are always
    // fingerprinted: a topic rename must fire drift detection).
    messages: [
      "paramControlMessage",
      "groupControlMessage",
      "shadowUpdateDocumentsMessage",
      "shadowDeltaMessage",
      "shadowUpdateAcceptedMessage",
      "shadowUpdateRejectedMessage",
    ],
    exportedSchemas: ["shadowDocument"],
  },
  {
    specFile: "Push_User.yaml",
    format: "asyncapi",
    messagePrefix: "push",
    messages: ["apnsNotification", "fcmNotification"],
    exportedSchemas: ["EventData", "ApnsPayload", "Aps", "FcmPayload", "FcmData"],
  },
];

/**
 * Conscious-ignore ledger for the tracking-coverage check
 * (`npm run contracts:coverage-check`).
 *
 * Every SDK path in `APIPathV1` must be EITHER drift-tracked above OR listed
 * here with a reason. This is not an escape hatch for laziness — an entry
 * here means "we looked at this path and decided not to track it, and here
 * is why". The check fails on stale entries, so the ledger cannot rot.
 */
export const untrackedPaths = [];
