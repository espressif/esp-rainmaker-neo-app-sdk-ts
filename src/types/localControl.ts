/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Per-connection session details passed to {@link
 * ESPLocalControlAdapterInterface.connect}. The protocomm handshake endpoint
 * differs per local-control protocol, so the transport tells the native layer
 * which paths to use instead of the adapter hardcoding them.
 *
 * Adapters built against an earlier SDK simply ignore the extra argument and
 * keep using their built-in default paths.
 */
export interface ESPLocalControlSessionOptions {
  /** Protocol tag, one of {@link ESPLocalControlProtocol}. */
  protocol: string;
  /** Protocomm session-security endpoint, e.g. `rmaker_local_ctrl/session`. */
  sessionPath: string;
  /** Version/service-info endpoint, e.g. `rmaker_local_ctrl/version`. */
  versionPath: string;
  /**
   * Root key to read in the version response when probing the security scheme
   * version, e.g. `rmaker_local_ctrl` for `{"rmaker_local_ctrl": {…}}`.
   */
  versionKey: string;
}

/**
 * Local control adapter interface for node communication over LAN.
 */
export interface ESPLocalControlAdapterInterface {
  /**
   * Checks if the node is connected.
   */
  isConnected(nodeId: string): Promise<boolean>;

  /**
   * Connects to the node with local control parameters.
   *
   * @param options - Session endpoints for the protocol in use. Omitted only by
   *   callers that want the adapter's built-in default paths.
   */
  connect(
    nodeId: string,
    baseUrl: string,
    securtiyType: number,
    pop?: string,
    username?: string,
    options?: ESPLocalControlSessionOptions
  ): Promise<Record<string, unknown>>;

  /**
   * Sends data to the specified path on the node.
   */
  sendData(nodeId: string, path: string, data: string): Promise<string>;
}
