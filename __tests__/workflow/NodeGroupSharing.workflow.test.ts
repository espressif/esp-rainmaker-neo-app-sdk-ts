/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Workflow (SDK integration) test: Node Group Sharing.
 *
 *   Fetch groups  ->  Share group  ->  Recipient lists requests
 *                 ->  Recipient accepts  ->  Verify share status  ->  Cleanup
 *
 * This is the first integration workflow described in the testing strategy. It
 * exercises the *real* SDK modules — ESPRMNeoUser.getGroups / listSharingRequests,
 * ESPRMNeoGroup.share / getSharingInfo / removeMember, ESPRMNeoSharingRequest.accept —
 * wired together. The only thing mocked is the HTTP boundary
 * (`ESPSigV4APIManager`), which is backed by the OpenAPI mock server returning
 * schema-validated fixtures. That keeps the test deterministic and offline while
 * still verifying request construction, response mapping, and module hand-offs.
 *
 * Every response the mock serves is asserted against the OpenAPI-derived schema,
 * so the workflow cannot silently drift from the backend contract.
 */

import { MockApiManager } from "../../test-utils/mock-server";
import { assertValidSchema } from "../../test-utils/schema-validator";

// ---------------------------------------------------------------------------
// Boundary mocks. ESPSigV4APIManager.getInstance() returns our mock server.
// ---------------------------------------------------------------------------
let backend: MockApiManager;

jest.mock("../../src/services/ESPSigV4APIManager", () => ({
  ESPSigV4APIManager: {
    getInstance: () => (global as unknown as { __mockApi: MockApiManager }).__mockApi,
    initialize: jest.fn(),
  },
}));

jest.mock("../../src/ESPRMNeoBase", () => ({
  ESPRMNeoBase: {
    init: jest.fn(),
    getConfig: () => ({
      baseUrl: "https://api.test.local",
      userApiBase: "https://api.test.local",
      awsRegion: "us-east-1",
      userPoolId: "test-pool",
      clientId: "test-client",
      identityId: "test-identity",
      iotEndpoint: "test-iot.local",
    }),
  },
}));

jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage", () => ({
  ESPRMNeoStorage: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("../../src/services/ESPRMNeoHelpers/DecodeToken", () => ({
  decodeToken: () => ({ "cognito:username": "primary-user-id" }),
}));

// Real SDK classes + method registrations (loaded AFTER mocks).
import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { ESPRMNeoGroup } from "../../src/ESPRMNeoGroup";
import "../../src/methods/ESPRMNeoUser/GetGroups";
import "../../src/methods/ESPRMNeoUser/ListSharingRequests";
import "../../src/methods/ESPRMNeoGroup/Share";
import "../../src/methods/ESPRMNeoGroup/GetSharingInfo";
import "../../src/methods/ESPRMNeoGroup/RemoveMember";
import "../../src/methods/ESPRMNeoSharingRequest/Accept";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------
const GROUP_ID = "group-living-room";
const GROUP_NAME = "Living Room";
const NODE_ID = "node-abc-123";
const RECIPIENT_USERNAME = "guest@example.com";
const RECIPIENT_USER_ID = "recipient-user-id";
const RECIPIENT_EMAIL = "guest@example.com";
const PRIMARY_USER_ID = "primary-user-id";
const REQUEST_ID = "sharing-req-001";

const FAKE_TOKENS = {
  accessToken: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.x",
  idToken: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.x",
  refreshToken: "refresh",
};

/**
 * Builds the stateful mock backend for the sharing workflow. Responses are
 * OpenAPI fixtures with workflow-specific IDs patched in, then asserted valid
 * against the contract before they are served.
 */
function buildSharingBackend(): MockApiManager {
  const state = {
    sharedWith: [] as { user_id: string; email: string; access_type: string }[],
    pendingRequest: null as null | {
      sharing_request_id: string;
      group_id: string;
      access_type: string;
    },
  };

  const api = new MockApiManager();

  // 1) List groups owned by the primary user.
  api.on("GET", "/v1/groups", () => {
    const body = {
      groups: [
        {
          group_id: GROUP_ID,
          group_name: GROUP_NAME,
          access_type: "primary",
          node_ids: [NODE_ID],
        },
      ],
    };
    assertValidSchema("ListGroupsResponse", body);
    return body;
  });

  // 2) Primary shares the group -> creates a sharing request.
  api.on("POST", "/v1/groups/:groupId/sharing-requests", ({ params, data }) => {
    const payload = data as { username?: string; access_type?: string };
    assertValidSchema("CreateSharingRequestRequest", data);
    if (!payload.username) throw new Error("username missing in request body");

    state.pendingRequest = {
      sharing_request_id: REQUEST_ID,
      group_id: params.groupId,
      access_type: payload.access_type ?? "secondary",
    };

    const body = { request_id: REQUEST_ID, message: "Invitation sent" };
    assertValidSchema("CreateSharingRequestResponse", body);
    return body;
  });

  // 3) Recipient lists the requests waiting in their inbox.
  api.on("GET", "/v1/sharing-requests/received", () => {
    const requests = state.pendingRequest
      ? [
          {
            sharing_request_id: state.pendingRequest.sharing_request_id,
            group_id: state.pendingRequest.group_id,
            subgroup_id: "",
            access_type: state.pendingRequest.access_type,
            primary_user_id: PRIMARY_USER_ID,
            primary_email: "owner@example.com",
            primary_phone_number: "",
          },
        ]
      : [];
    const body = { sharing_requests: requests };
    assertValidSchema("ListSharingRequestsResponse", body);
    return body;
  });

  // 4) Recipient accepts -> becomes a member of the group.
  api.on("POST", "/v1/sharing-requests/:requestId/accept", ({ params }) => {
    if (!state.pendingRequest || state.pendingRequest.sharing_request_id !== params.requestId) {
      throw new Error(`Unknown sharing request ${params.requestId}`);
    }
    state.sharedWith.push({
      user_id: RECIPIENT_USER_ID,
      email: RECIPIENT_EMAIL,
      access_type: state.pendingRequest.access_type,
    });
    state.pendingRequest = null;
    const body = { message: "Sharing request accepted" };
    assertValidSchema("APIStatusMessage", body);
    return body;
  });

  // 5) Verify share status -> who has access to the group now.
  api.on("GET", "/v1/groups/:groupId/users", () => {
    const users = [
      { user_id: PRIMARY_USER_ID, email: "owner@example.com", access_type: "primary" },
      ...state.sharedWith,
    ];
    const body = { users };
    assertValidSchema("ListGroupUsersResponse", body);
    return body;
  });

  // 6) Cleanup -> remove the member (204 No Content semantics, empty body).
  api.on("DELETE", "/v1/groups/:groupId/users/:userId", ({ params }) => {
    state.sharedWith = state.sharedWith.filter((u) => u.user_id !== params.userId);
    return {};
  });

  return api;
}

describe("Workflow: Node Group Sharing", () => {
  let primary: ESPRMNeoUser;
  let recipient: ESPRMNeoUser;

  beforeEach(() => {
    backend = buildSharingBackend();
    (global as unknown as { __mockApi: MockApiManager }).__mockApi = backend;
    // Two SDK sessions sharing one mock backend (same data store).
    primary = new ESPRMNeoUser(FAKE_TOKENS);
    recipient = new ESPRMNeoUser(FAKE_TOKENS);
  });

  it("shares a group, the recipient accepts, and the share is verifiable", async () => {
    // --- Step 1: primary fetches their groups -------------------------------
    const groups = await primary.getGroups();
    expect(groups).toHaveLength(1);
    const group = groups[0];
    expect(group).toBeInstanceOf(ESPRMNeoGroup);
    expect(group.groupId).toBe(GROUP_ID);
    expect(group.groupName).toBe(GROUP_NAME);
    expect(group.accessType).toBe("primary");

    // --- Step 2: primary shares the group -----------------------------------
    const shareResult = await group.share({
      username: RECIPIENT_USERNAME,
      accessType: "secondary",
    });
    expect(shareResult).toBeDefined();
    // The mock recorded the outgoing request with the correct path + body.
    const shareCall = backend.calls.find(
      (c) => c.method === "POST" && c.path === `/v1/groups/${GROUP_ID}/sharing-requests`
    );
    expect(shareCall).toBeDefined();
    expect(shareCall?.data).toEqual({
      username: RECIPIENT_USERNAME,
      access_type: "secondary",
    });

    // --- Step 3: recipient lists pending sharing requests -------------------
    const requests = await recipient.listSharingRequests();
    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request.sharingRequestId).toBe(REQUEST_ID);
    expect(request.groupId).toBe(GROUP_ID);

    // --- Step 4: recipient accepts ------------------------------------------
    const acceptResult = await request.accept();
    expect(acceptResult.message).toBe("Sharing request accepted");

    // --- Step 5: verify share status ----------------------------------------
    const sharingInfo = await group.getSharingInfo();
    expect(sharingInfo.users).toHaveLength(2);
    const guest = sharingInfo.users.find((u) => u.userId === RECIPIENT_USER_ID);
    expect(guest).toBeDefined();
    expect(guest?.accessType).toBe("secondary");
    expect(guest?.email).toBe(RECIPIENT_EMAIL);

    // --- Step 6: cleanup -----------------------------------------------------
    await group.removeMember(RECIPIENT_USER_ID);
    const afterCleanup = await group.getSharingInfo();
    expect(afterCleanup.users).toHaveLength(1);
    expect(
      afterCleanup.users.find((u) => u.userId === RECIPIENT_USER_ID)
    ).toBeUndefined();
  });

  it("rejects sharing without a username (no request is sent)", async () => {
    const [group] = await primary.getGroups();
    await expect(
      group.share({ accessType: "secondary" } as never)
    ).rejects.toThrow(/username/i);
    const shareCalls = backend.calls.filter((c) => c.path.includes("sharing-requests"));
    expect(shareCalls).toHaveLength(0);
  });
});
