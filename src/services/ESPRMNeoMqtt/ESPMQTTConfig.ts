/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/** Credentials and endpoint for MQTT connect (SigV4 / temporary creds). */
export interface ESPMQTTConfig {
  clientId: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
  sessionToken: string;
  region:string
  /**
   * Optional expiry hint for the credentials. Not needed to open the MQTT
   * connection. An adapter may use it to schedule a proactive reconnect
   * before AWS drops the socket when the creds expire.
   */
  expiration?: string;
}
