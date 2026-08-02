/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  transformShadowToNodeUpdate,
  NODE_PARAMS_CHANGED_EVENT,
} from "../../../src/services/ESPRMNeoHelpers/transformShadowToNodeUpdate";

describe("transformShadowToNodeUpdate", () => {
  it("builds the canonical envelope from a reported device map", () => {
    const shadowDoc = {
      state: { reported: { Light: { power: true } } },
      version: 7,
      timestamp: 111,
    };
    const update = transformShadowToNodeUpdate("node-1", shadowDoc, {
      shadowName: "params-g1",
    });

    expect(update.nodeId).toBe("node-1");
    expect(update.source).toBe("mqtt");
    expect(update.eventType).toBe(NODE_PARAMS_CHANGED_EVENT);
    expect(update.payload).toEqual({ Light: { power: true } });
    // metadata carries the channel info plus the full raw shadow (for consumers
    // that need fields beyond the param map, e.g. online / ncfg_ver).
    expect(update.metadata).toEqual({
      shadowName: "params-g1",
      version: 7,
      timestamp: 111,
      shadow: shadowDoc,
    });
  });

  it("prefers state.reported.params when present", () => {
    const update = transformShadowToNodeUpdate("node-1", {
      state: { reported: { params: { Fan: { speed: 2 } }, online: true } },
    });
    expect(update.payload).toEqual({ Fan: { speed: 2 } });
  });

  it("returns an empty payload when reported state is missing", () => {
    expect(
      transformShadowToNodeUpdate("node-1", { state: {} }).payload
    ).toEqual({});
    expect(transformShadowToNodeUpdate("node-1", null).payload).toEqual({});
    expect(transformShadowToNodeUpdate("node-1", undefined).payload).toEqual(
      {}
    );
  });

  it("honors a custom source and merges metadata", () => {
    const update = transformShadowToNodeUpdate(
      "node-9",
      { state: { reported: { x: 1 } }, version: 1 },
      { topic: "t", endpointId: 1 },
      "matter"
    );
    expect(update.source).toBe("matter");
    expect(update.metadata).toMatchObject({
      topic: "t",
      endpointId: 1,
      version: 1,
    });
  });
});
