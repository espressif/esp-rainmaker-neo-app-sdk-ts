/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ESPRMNeoNode } from "../../ESPRMNeoNode";
import {
  RMakerLocalCtrlDataType,
  RMakerLocalCtrlProtoHelper,
} from "../../proto/rmaker_local_ctrl";
import type { ESPLocalControlSessionOptions } from "../../types/localControl";
import { ESPAPIResponse } from "../../types/output";
import {
  ESPLocalControlProtocol,
  ESPTransportConfig,
  ESPTransportInterface,
} from "../../types/transport";
import {
  RMAKER_LOCAL_CTRL_VERSION_KEY,
  RMakerLocalCtrlEndpoint,
  RMakerLocalCtrlSetParamsStatus,
} from "../../utils/constants";
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../ESPRMNeoHelpers/TransformEncoding";
import {
  ensureLocalControlSession,
  getLocalControlAdapter,
} from "./LocalControlSession";

/**
 * Tail of the in-flight fragmented-read chain, per node id.
 *
 * Module-level on purpose: {@link delegatedTransportHandler} builds a fresh
 * transport for every call, so a queue held on the instance would serialize
 * nothing. Keyed by node, because the transfer cache is per device.
 */
const nodeReadQueues = new Map<string, Promise<void>>();

/**
 * Runs `read` after every fragmented read already queued for `nodeId`.
 *
 * A failed read must not wedge the queue, so the chain advances on rejection
 * too, while the caller still sees the original rejection. The map entry is
 * dropped once the chain drains, so a long-lived app doesn't retain one promise
 * per node it has ever talked to.
 *
 * @param nodeId - Node whose reads are being serialized.
 * @param read - Pull loop to run once the node is free.
 */
function enqueueNodeRead<T>(
  nodeId: string,
  read: () => Promise<T>
): Promise<T> {
  const previous = nodeReadQueues.get(nodeId) ?? Promise.resolve();
  const result = previous.then(read, read);

  const tail = result.then(
    () => undefined,
    () => undefined
  );
  nodeReadQueues.set(nodeId, tail);
  void tail.then(() => {
    // Only the current tail clears the entry; otherwise a newer read owns it.
    if (nodeReadQueues.get(nodeId) === tail) {
      nodeReadQueues.delete(nodeId);
    }
  });

  return result;
}

/** Session endpoints of the `rmaker_local_ctrl` protocol, passed to the adapter. */
const RMAKER_SESSION_OPTIONS: ESPLocalControlSessionOptions = {
  protocol: ESPLocalControlProtocol.rmakerLocalCtrl,
  sessionPath: RMakerLocalCtrlEndpoint.SESSION,
  versionPath: RMakerLocalCtrlEndpoint.VERSION,
  versionKey: RMAKER_LOCAL_CTRL_VERSION_KEY,
};

/**
 * The built-in `local` transport, speaking the `rmaker_local_ctrl` endpoint
 * protocol over the app-supplied {@link ESPRMNeoBase.ESPLocalControlAdapter}:
 *
 * - `set_params` carries the same raw JSON body as a cloud set-params call and
 *   answers `{"status":"success"}` / `{"status":"fail","description":…}`.
 * - `get_params` / `get_config` exchange protobuf `CmdGetData`/`RespGetData` and
 *   are fragmented — the client pulls fixed-size chunks by offset until
 *   `TotalLen` is covered.
 *
 * Connection metadata (`baseUrl`, `securityType`, `pop`, and `username` for
 * sec2) is supplied via the transport config by {@link
 * delegatedTransportHandler}; security 0 is not offered by this protocol.
 */
class ESPLocalControlTransport implements ESPTransportInterface {
  metadata: Record<string, any>;

  constructor(transportConfig: ESPTransportConfig) {
    this.metadata = transportConfig.metadata ?? {};
  }

  private get adapter() {
    return getLocalControlAdapter();
  }

  private async ensureConnected(nodeId: string): Promise<void> {
    await ensureLocalControlSession(
      this.adapter,
      nodeId,
      this.metadata,
      RMAKER_SESSION_OPTIONS
    );
  }

  /**
   * Applies params over `set_params`.
   *
   * @param payload - `{ node_id, payload }`, where `payload` is the
   *   `{ <deviceOrServiceName>: { <paramName>: value } }` map to write.
   * @throws {Error} When the device reports a non-success status.
   */
  async setParam(
    payload: Record<string, any>,
    _nodeRef?: ESPRMNeoNode
  ): Promise<ESPAPIResponse> {
    const nodeId = payload?.node_id;
    await this.ensureConnected(nodeId);

    const request = uint8ArrayToBase64(
      new TextEncoder().encode(JSON.stringify(payload?.payload ?? {}))
    );
    const response = await this.adapter.sendData(
      nodeId,
      RMakerLocalCtrlEndpoint.SET_PARAMS,
      request
    );
    this.assertSetParamsAccepted(response);

    return { message: "Parameters updated successfully", statusCode: 200 };
  }

  /**
   * Reads the node's full params document over `get_params`.
   *
   * @param payload - `{ node_id }` identifying the node to read.
   * @returns The params JSON, keyed by device/service name.
   */
  async getParams(
    payload: Record<string, any>,
    _nodeRef?: ESPRMNeoNode
  ): Promise<Record<string, any>> {
    const nodeId = payload?.node_id;
    await this.ensureConnected(nodeId);
    return this.readJsonDocument(
      nodeId,
      RMakerLocalCtrlDataType.TypeParams,
      RMakerLocalCtrlEndpoint.GET_PARAMS
    );
  }

  /**
   * Reads the node's config document over `get_config`. Not part of
   * {@link ESPTransportInterface} — the node config normally comes from the
   * cloud; this serves LAN-only flows.
   *
   * @param nodeId - Node to read from.
   * @returns The node config JSON.
   */
  async getConfig(nodeId: string): Promise<Record<string, any>> {
    await this.ensureConnected(nodeId);
    return this.readJsonDocument(
      nodeId,
      RMakerLocalCtrlDataType.TypeConfig,
      RMakerLocalCtrlEndpoint.GET_CONFIG
    );
  }

  // ── set ──────────────────────────────────────────────────────────────────

  /**
   * Validates a `set_params` raw-JSON response.
   *
   * @throws {Error} When the body is unparseable or reports a failure.
   */
  private assertSetParamsAccepted(response: string): void {
    const text = new TextDecoder().decode(base64ToUint8Array(response ?? ""));
    let parsed: { status?: string; description?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        `Unexpected set_params response from device: ${text || "<empty>"}`
      );
    }
    if (parsed?.status !== RMakerLocalCtrlSetParamsStatus.SUCCESS) {
      throw new Error(
        parsed?.description ??
          "Failed to set device params over local control (rmaker_local_ctrl)"
      );
    }
  }

  // ── get ──────────────────────────────────────────────────────────────────

  /**
   * Pulls a fragmented document and parses it as JSON, serialized against every
   * other fragmented read of the same node.
   *
   * The device holds **one global transfer cache**, not one per session: an
   * offset-0 request regenerates it and it is freed after the last fragment. So
   * a `getParams()` racing a `getConfig()` on the same node would clobber the
   * other — the second offset-0 regenerates the cache mid-transfer, and the
   * first read's next fragment comes back `Fail` (or, worse, carries bytes from
   * the wrong document). The queue makes that interleaving impossible rather
   * than detecting it after the fact.
   *
   * @param nodeId - Node to read from.
   * @param dataType - Which document to read (params or config).
   * @param endpoint - Endpoint serving that document.
   * @throws {Error} When the device reports a failure, the response is
   *   malformed, or a fragment makes no forward progress.
   */
  private readJsonDocument(
    nodeId: string,
    dataType: RMakerLocalCtrlDataType,
    endpoint: string
  ): Promise<Record<string, any>> {
    return enqueueNodeRead(nodeId, () =>
      this.pullJsonDocument(nodeId, dataType, endpoint)
    );
  }

  /** The client-pull loop itself; always reached via {@link readJsonDocument}. */
  private async pullJsonDocument(
    nodeId: string,
    dataType: RMakerLocalCtrlDataType,
    endpoint: string
  ): Promise<Record<string, any>> {
    const fragments: Uint8Array[] = [];
    let offset = 0;
    let totalLength = 0;

    do {
      const response = await this.adapter.sendData(
        nodeId,
        endpoint,
        this.buildGetDataRequest(dataType, offset)
      );
      const buf = this.processGetDataResponse(response, offset);

      totalLength = buf.totalLength;
      if (totalLength === 0) {
        return {};
      }
      if (buf.payload.length === 0) {
        // Without forward progress the pull loop would never terminate.
        throw new Error(
          `Device returned an empty fragment at offset ${offset} of ${totalLength} on ${endpoint}`
        );
      }

      fragments.push(buf.payload);
      offset += buf.payload.length;
    } while (offset < totalLength);

    if (offset > totalLength) {
      throw new Error(
        `Fragmented read of ${endpoint} overran: got ${offset} bytes, expected ${totalLength}`
      );
    }

    return this.parseJsonFragments(fragments, endpoint);
  }

  private buildGetDataRequest(
    dataType: RMakerLocalCtrlDataType,
    offset: number
  ): string {
    return uint8ArrayToBase64(
      RMakerLocalCtrlProtoHelper.createGetDataRequest(dataType, offset)
    );
  }

  /**
   * Parses one `RespGetData` and checks it answers the requested offset.
   *
   * @param response - Base64 protobuf response from the adapter.
   * @param requestedOffset - Offset asked for, used to detect a desynced pull.
   */
  private processGetDataResponse(
    response: string,
    requestedOffset: number
  ): { payload: Uint8Array; totalLength: number } {
    const parsed = RMakerLocalCtrlProtoHelper.parseGetDataResponse(
      base64ToUint8Array(response)
    );
    if (!RMakerLocalCtrlProtoHelper.isSuccess(parsed)) {
      throw new Error(
        `Device rejected the local-control read (status ${RMakerLocalCtrlProtoHelper.getStatus(
          parsed
        )})`
      );
    }

    const fragmentOffset = RMakerLocalCtrlProtoHelper.getOffset(parsed);
    if (fragmentOffset !== requestedOffset) {
      throw new Error(
        `Device answered offset ${fragmentOffset}, expected ${requestedOffset}`
      );
    }

    return {
      payload: RMakerLocalCtrlProtoHelper.getPayload(parsed),
      totalLength: RMakerLocalCtrlProtoHelper.getTotalLen(parsed),
    };
  }

  /** Joins the pulled fragments and parses the result as JSON. */
  private parseJsonFragments(
    fragments: Uint8Array[],
    endpoint: string
  ): Record<string, any> {
    const joined = new Uint8Array(
      fragments.reduce((length, fragment) => length + fragment.length, 0)
    );
    let position = 0;
    for (const fragment of fragments) {
      joined.set(fragment, position);
      position += fragment.length;
    }

    const text = new TextDecoder().decode(joined);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Device returned malformed JSON on ${endpoint}`);
    }
  }
}

export { ESPLocalControlTransport };
