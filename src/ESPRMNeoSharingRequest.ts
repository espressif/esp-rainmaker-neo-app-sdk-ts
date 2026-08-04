/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SharingRequestAccessType,
  SharingRequestInfo,
} from "./types/output";

/**
 * Represents a sharing request in the ESP Rainmaker Neo SDK.
 * Provides instance methods for sharing request operations.
 */
export class ESPRMNeoSharingRequest {
  sharingRequestId: string;
  groupId: string;
  subgroupId: string;
  accessType: SharingRequestAccessType;
  /** Primary user information who sent the share invitation. */
  primaryUserId: string;
  primaryEmail: string;
  primaryPhoneNumber: string;

  constructor(data: SharingRequestInfo) {
    this.sharingRequestId = data.sharing_request_id;
    this.groupId = data.group_id;
    this.subgroupId = data.subgroup_id;
    this.accessType = data.access_type;
    this.primaryUserId = data.primary_user_id ?? "";
    this.primaryEmail = data.primary_email ?? "";
    this.primaryPhoneNumber = data.primary_phone_number ?? "";
  }
}
