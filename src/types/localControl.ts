/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

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
   */
  connect(
    nodeId: string,
    baseUrl: string,
    securtiyType: number,
    pop?: string,
    username?: string
  ): Promise<Record<string, unknown>>;

  /**
   * Sends data to the specified path on the node.
   */
  sendData(nodeId: string, path: string, data: string): Promise<string>;
}

