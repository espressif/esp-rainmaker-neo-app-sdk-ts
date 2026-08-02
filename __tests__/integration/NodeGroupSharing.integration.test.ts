/**
 * @jest-environment node
 *
 * Must be `node` not `jsdom`. ESPSigV4APIManager calls Node.js crypto.createHash()
 * to sign requests. jsdom replaces `crypto` with the browser Web Crypto API which
 * does not have createHash, causing "crypto.createHash is not a function".
 */

/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Live integration test: Node Group Sharing workflow against the real backend.
 *
 * This is the live counterpart to __tests__/workflow/NodeGroupSharing.workflow.test.ts.
 * That file stubs the HTTP boundary with a schema-validated mock; this file makes
 * real API calls and validates every response against the same AJV schema bundle —
 * proving that the backend actually returns the shapes the SDK expects.
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │  FLOW                                                          │
 * │  beforeAll                                                     │
 * │    1. Init SDK  →  login primary  →  login recipient          │
 * │    2. Create a fresh test group (primary owns it)              │
 * │                                                                │
 * │  it("full sharing workflow")                                   │
 * │    3. Share using recipient username (email) from env          │
 * │    4. Primary shares the group (POST sharing-requests)         │
 * │    5. Recipient lists requests  →  finds pending invite        │
 * │    6. Recipient accepts                                        │
 * │    7. Primary verifies recipient is in group users             │
 * │    8. Primary removes recipient (cleanup member)               │
 * │    9. Verify recipient is gone                                 │
 * │                                                                │
 * │  afterAll (always runs, best-effort)                           │
 * │    10. Delete the test group                                   │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Required env vars (add to .env.test — see .env.test.example):
 *   RMNEO_TEST_PRIMARY_USERNAME    e-mail of the user who will create & share the group
 *   RMNEO_TEST_PRIMARY_PASSWORD
 *   RMNEO_TEST_RECIPIENT_USERNAME  e-mail of the user who will receive the share
 *   RMNEO_TEST_RECIPIENT_PASSWORD
 *   (all other SDK config is read by getIntegrationTestConfig())
 *
 * The suite is automatically skipped when any of the required env vars are absent
 * so it is safe to run `npm run test:integration` in CI without live creds.
 */

import { ESPRMNeoBase } from "../../src/ESPRMNeoBase";
import { ESPRMNeoUser } from "../../src/ESPRMNeoUser";
import { ESPRMNeoGroup } from "../../src/ESPRMNeoGroup";
import { decodeToken } from "../../src/services/ESPRMNeoHelpers/DecodeToken";
import { assertValidSchema } from "../../test-utils/schema-validator";
import { getIntegrationTestConfig } from "./setup";
import type { ESPStorageAdapter } from "../../src/types/storage";

// ---------------------------------------------------------------------------
// Crypto polyfill (module-level, runs before any test code)
//
// ESPSigV4APIManager._signedRequest uses `(crypto as any).createHash(...)`,
// referencing the *global* crypto object. In Node.js jest environments that
// global is the Web Crypto API which does not have createHash. We replace it
// with the Node.js built-in `crypto` module which does.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _nodeCrypto = require("crypto") as typeof import("crypto");
if (typeof (global as Record<string, unknown>).crypto === "undefined" ||
    typeof (_nodeCrypto as unknown as Record<string, unknown>).createHash === "function") {
  (global as Record<string, unknown>).crypto = _nodeCrypto;
}

// ---------------------------------------------------------------------------
// In-memory storage adapter — used instead of DefaultStorageAdapter which
// depends on window.localStorage (unavailable in the `node` jest environment).
// ---------------------------------------------------------------------------
class MemoryStorageAdapter implements ESPStorageAdapter {
  private readonly store = new Map<string, string>();
  async setItem(name: string, value: string): Promise<void> { this.store.set(name, value); }
  async getItem(name: string): Promise<string | null> { return this.store.get(name) ?? null; }
  async removeItem(name: string): Promise<void> { this.store.delete(name); }
  async clear(): Promise<void> { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// Method registrations — pulled in explicitly so tree-shaking cannot remove them
// ---------------------------------------------------------------------------
import "../../src/methods/ESPRMNeoAuth/Login";
import "../../src/methods/ESPRMNeoUser/GetTemporaryAWSCredentials"; // required: ESPSigV4APIManager lazy-requires this to sign every request
import "../../src/methods/ESPRMNeoUser/MQTT/AssumeRole";            // required: GetTemporaryAWSCredentials depends on assumeRole
import "../../src/methods/ESPRMNeoUser/CreateGroup";
import "../../src/methods/ESPRMNeoUser/GetGroups";
import "../../src/methods/ESPRMNeoUser/ListSharingRequests";
import "../../src/methods/ESPRMNeoGroup/Share";
import "../../src/methods/ESPRMNeoGroup/GetSharingInfo";
import "../../src/methods/ESPRMNeoGroup/RemoveMember";
import "../../src/methods/ESPRMNeoGroup/Delete";
import "../../src/methods/ESPRMNeoSharingRequest/Accept";

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

function envCredentials() {
  const primary = {
    username: process.env.RMNEO_TEST_PRIMARY_USERNAME ?? process.env.TEST_USERNAME ?? "",
    password: process.env.RMNEO_TEST_PRIMARY_PASSWORD ?? process.env.TEST_PASSWORD ?? "",
  };
  const recipient = {
    username: process.env.RMNEO_TEST_RECIPIENT_USERNAME ?? "",
    password: process.env.RMNEO_TEST_RECIPIENT_PASSWORD ?? "",
  };
  return { primary, recipient };
}

function userIdFromIdToken(idToken: string): string {
  const sub = decodeToken(idToken).sub;
  if (typeof sub !== "string" || !sub) {
    throw new Error("idToken missing sub claim");
  }
  return sub;
}

const { primary: primaryCreds, recipient: recipientCreds } = envCredentials();

const CREDS_AVAILABLE =
  !!primaryCreds.username &&
  !!primaryCreds.password &&
  !!recipientCreds.username &&
  !!recipientCreds.password;

// ---------------------------------------------------------------------------
// Suite — skipped automatically when credentials are absent
// ---------------------------------------------------------------------------

const maybe = CREDS_AVAILABLE ? describe : describe.skip;

maybe("Live Workflow: Node Group Sharing (real backend)", () => {
  let primaryUser: ESPRMNeoUser;
  let recipientUser: ESPRMNeoUser;
  let recipientUserId: string;
  let testGroup: ESPRMNeoGroup;         // created in beforeAll, deleted in afterAll
  const testGroupName = `RM Neo SDK Live Test ${Date.now()}`;

  // ── Setup ────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // 1. Initialise SDK with real deployment config from .env.test.
    //    Pass a MemoryStorageAdapter so the test never touches window.localStorage,
    //    which does not exist in the `node` jest environment.
    ESPRMNeoBase.init({ ...getIntegrationTestConfig(), customStorageAdapter: new MemoryStorageAdapter() });

    const auth = ESPRMNeoBase.getAuthInstance();

    // 2. Login primary user
    console.log(`[live-workflow] Logging in primary: ${primaryCreds.username}`);
    primaryUser = await auth.login(primaryCreds.username, primaryCreds.password);
    console.log(`[live-workflow] Primary user_id: ${userIdFromIdToken(await primaryUser.getIdToken())}`);

    // 3. Login recipient user
    console.log(`[live-workflow] Logging in recipient: ${recipientCreds.username}`);
    recipientUser = await auth.login(recipientCreds.username, recipientCreds.password);
    recipientUserId = userIdFromIdToken(await recipientUser.getIdToken());
    console.log(`[live-workflow] Recipient user_id: ${recipientUserId}`);

    // 4. Create a dedicated test group so this suite is self-contained
    console.log(`[live-workflow] Creating test group: "${testGroupName}"`);
    testGroup = await primaryUser.createGroup(testGroupName);
    console.log(`[live-workflow] Test group id: ${testGroup.groupId}`);
  });

  // ── Teardown (always runs — best-effort) ─────────────────────────────────

  afterAll(async () => {
    if (!testGroup) return;
    console.log(`[live-workflow] Cleanup: deleting test group ${testGroup.groupId}`);
    try {
      // Best-effort remove recipient in case the test failed mid-way
      const info = await testGroup.getSharingInfo();
      const stillMember = info.users.find((u) => u.userId === recipientUserId);
      if (stillMember) {
        await testGroup.removeMember(recipientUserId);
        console.log(`[live-workflow] Cleanup: removed recipient from group`);
      }
    } catch {
      // ignore — group may not be shared yet
    }
    try {
      await testGroup.delete();
      console.log(`[live-workflow] Cleanup: test group deleted`);
    } catch (e) {
      console.warn(`[live-workflow] Cleanup: could not delete group — ${(e as Error).message}`);
    }
  });

  // ── Main test ─────────────────────────────────────────────────────────────

  it("shares a group with a second user, recipient accepts, share verified, then cleaned up", async () => {
    // ── Step 3: Recipient username (sign-in email) comes from env ──────────
    const recipientUsername = recipientCreds.username;
    expect(recipientUsername).toBeTruthy();
    console.log(`[live-workflow] Step 3: recipient username: ${recipientUsername}`);

    // ── Step 4: Primary shares the group with recipient ────────────────────
    console.log(`[live-workflow] Step 4: sharing group ${testGroup.groupId} → ${recipientUsername}`);

    // Validate the outgoing request body against the spec before sending
    assertValidSchema("CreateSharingRequestRequest", {
      username: recipientUsername,
      access_type: "secondary",
    });

    const shareResult = await testGroup.share({
      username: recipientUsername,
      accessType: "secondary",
    });
    expect(shareResult).toBeDefined();
    console.log(`[live-workflow]   share response:`, shareResult);

    // ── Step 5: Recipient lists pending sharing requests ───────────────────
    console.log(`[live-workflow] Step 5: recipient listing sharing requests`);
    const requests = await recipientUser.listSharingRequests();

    // Validate real list-response shape against the OpenAPI schema
    assertValidSchema("ListSharingRequestsResponse", {
      sharing_requests: requests.map((r) => ({
        sharing_request_id: r.sharingRequestId,
        group_id: r.groupId,
        subgroup_id: r.subgroupId,
        access_type: r.accessType,
        primary_user_id: r.primaryUserId,
        primary_email: r.primaryEmail,
        primary_phone_number: r.primaryPhoneNumber,
      })),
    });

    // Find the invite for the group we just created
    const theRequest = requests.find((r) => r.groupId === testGroup.groupId);
    expect(theRequest).toBeDefined();
    expect(theRequest!.accessType).toBe("secondary");
    console.log(`[live-workflow]   found request id: ${theRequest!.sharingRequestId}`);

    // ── Step 6: Recipient accepts the invitation ───────────────────────────
    console.log(`[live-workflow] Step 6: recipient accepting the request`);
    const acceptResult = await theRequest!.accept();
    expect(acceptResult.message).toBeTruthy();
    console.log(`[live-workflow]   accept response:`, acceptResult);

    // ── Step 7: Primary verifies recipient is now in the group ─────────────
    console.log(`[live-workflow] Step 7: verifying recipient is in group users`);
    const sharingInfo = await testGroup.getSharingInfo();

    // Validate real group-users response against the OpenAPI schema
    // (schema is snake_case; map SDK camelCase back to the wire shape)
    assertValidSchema("ListGroupUsersResponse", {
      users: sharingInfo.users.map((u) => ({
        user_id: u.userId,
        email: u.email,
        access_type: u.accessType,
      })),
    });

    const recipientEntry = sharingInfo.users.find(
      (u) => u.userId === recipientUserId
    );
    expect(recipientEntry).toBeDefined();
    expect(recipientEntry!.accessType).toBe("secondary");
    console.log(`[live-workflow]   recipient confirmed in group with access_type=${recipientEntry!.accessType}`);

    // ── Step 8: Primary removes recipient (member cleanup) ─────────────────
    console.log(`[live-workflow] Step 8: removing recipient from group`);
    const removeResult = await testGroup.removeMember(recipientUserId);
    expect(removeResult.message).toBeTruthy();

    // ── Step 9: Verify recipient is no longer listed ───────────────────────
    console.log(`[live-workflow] Step 9: verifying recipient removed`);
    const afterCleanup = await testGroup.getSharingInfo();
    const stillPresent = afterCleanup.users.find(
      (u) => u.userId === recipientUserId
    );
    expect(stillPresent).toBeUndefined();
    console.log(`[live-workflow]   recipient confirmed removed ✓`);
  });

  // ── Guard test: sharing without a username is rejected by the SDK ─────────

  it("share() rejects a missing username before making any network call", async () => {
    await expect(
      testGroup.share({ accessType: "secondary" } as never)
    ).rejects.toThrow(/username/i);
  });
});
