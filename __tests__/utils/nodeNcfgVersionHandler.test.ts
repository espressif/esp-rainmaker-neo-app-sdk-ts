/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ESPRMNeoStorage } from "../../src/services/ESPRMNeoStorage/ESPRMNeoStorage";
import { StorageKeys } from "../../src/utils/constants";
import {
  clearAllNcfgVersionMarkers,
  clearNcfgVersionMarker,
  getNcfgVersion,
  hasNcfgVersionChanged,
  listTrackedNodeIds,
  persistNcfgVersionMarker,
} from "../../src/utils/nodeNcfgVersionHandler";

jest.mock("../../src/services/ESPRMNeoStorage/ESPRMNeoStorage");

const HASH_A =
  "3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b";
const HASH_B =
  "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

/** Simulates the single-blob marker store backed by ESPRMNeoStorage.getItem/setItem. */
function mockMarkerStore(initial: Record<string, string> = {}) {
  let state: Record<string, string> = { ...initial };
  (ESPRMNeoStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
    key === StorageKeys.NCFG_VERSIONS ? JSON.stringify(state) : null
  );
  (ESPRMNeoStorage.setItem as jest.Mock).mockImplementation(
    async (key: string, value: string) => {
      if (key === StorageKeys.NCFG_VERSIONS) {
        state = JSON.parse(value);
      }
    }
  );
  (ESPRMNeoStorage.removeItem as jest.Mock).mockImplementation(
    async (key: string) => {
      if (key === StorageKeys.NCFG_VERSIONS) {
        state = {};
      }
    }
  );
  return {
    snapshot: () => ({ ...state }),
  };
}

describe("nodeNcfgVersionHandler", () => {
  const nodeId = "node-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getNcfgVersion", () => {
    it("reads ncfg_ver hash string from reported state", () => {
      expect(
        getNcfgVersion({
          state: { reported: { ncfg_ver: HASH_A } },
        })
      ).toBe(HASH_A);
    });

    it("normalizes legacy integer timestamps to strings", () => {
      expect(
        getNcfgVersion({
          state: { reported: { ncfg_ver: 1712345678 } },
        })
      ).toBe("1712345678");
    });

    it("returns null when missing", () => {
      expect(getNcfgVersion({})).toBeNull();
    });

    it("returns null for empty or whitespace-only strings", () => {
      expect(
        getNcfgVersion({
          state: { reported: { ncfg_ver: "  " } },
        })
      ).toBeNull();
    });
  });

  describe("hasNcfgVersionChanged", () => {
    it("baselines marker on first sighting and returns false", async () => {
      const store = mockMarkerStore({});

      const changed = await hasNcfgVersionChanged(nodeId, {
        state: { reported: { ncfg_ver: HASH_A } },
      });

      expect(changed).toBe(false);
      expect(store.snapshot()).toEqual({ [nodeId]: HASH_A });
    });

    it("returns true when the hash differs", async () => {
      mockMarkerStore({ [nodeId]: HASH_A });

      const changed = await hasNcfgVersionChanged(nodeId, {
        state: { reported: { ncfg_ver: HASH_B } },
      });

      expect(changed).toBe(true);
    });

    it("treats legacy timestamp marker -> hash as a change", async () => {
      mockMarkerStore({ [nodeId]: "1712345678" });

      const changed = await hasNcfgVersionChanged(nodeId, {
        state: { reported: { ncfg_ver: HASH_A } },
      });

      expect(changed).toBe(true);
    });

    it("returns false when the version is unchanged", async () => {
      const store = mockMarkerStore({ [nodeId]: HASH_A });

      const changed = await hasNcfgVersionChanged(nodeId, {
        state: { reported: { ncfg_ver: HASH_A } },
      });

      expect(changed).toBe(false);
      expect(store.snapshot()).toEqual({ [nodeId]: HASH_A });
    });

    it("returns false for shadows without ncfg_ver", async () => {
      const store = mockMarkerStore({ [nodeId]: HASH_A });

      const changed = await hasNcfgVersionChanged(nodeId, {
        state: { reported: { params: { Light: { power: true } } } },
      });

      expect(changed).toBe(false);
      expect(store.snapshot()).toEqual({ [nodeId]: HASH_A });
    });
  });

  describe("persistNcfgVersionMarker", () => {
    it("updates the marker for the node", async () => {
      const store = mockMarkerStore({ [nodeId]: HASH_A });

      await persistNcfgVersionMarker(nodeId, {
        state: { reported: { ncfg_ver: HASH_B } },
      });

      expect(store.snapshot()).toEqual({ [nodeId]: HASH_B });
    });

    it("keeps other nodes' markers intact when updating one", async () => {
      const store = mockMarkerStore({ "node-a": HASH_A, "node-b": HASH_B });

      await persistNcfgVersionMarker("node-a", {
        state: { reported: { ncfg_ver: HASH_B } },
      });

      expect(store.snapshot()).toEqual({
        "node-a": HASH_B,
        "node-b": HASH_B,
      });
    });

    it("is a no-op when ncfg_ver is missing", async () => {
      const store = mockMarkerStore({ [nodeId]: HASH_A });

      await persistNcfgVersionMarker(nodeId, {
        state: { reported: { params: {} } },
      });

      expect(store.snapshot()).toEqual({ [nodeId]: HASH_A });
    });
  });

  describe("clearNcfgVersionMarker", () => {
    it("removes just the requested node id", async () => {
      const store = mockMarkerStore({ "node-a": HASH_A, "node-b": HASH_B });
      await clearNcfgVersionMarker("node-a");
      expect(store.snapshot()).toEqual({ "node-b": HASH_B });
    });

    it("is a no-op when the id is absent", async () => {
      const store = mockMarkerStore({ "node-b": HASH_B });
      await clearNcfgVersionMarker("node-a");
      expect(store.snapshot()).toEqual({ "node-b": HASH_B });
    });
  });

  describe("clearAllNcfgVersionMarkers", () => {
    it("returns the ids that were cleared and wipes the blob", async () => {
      const store = mockMarkerStore({ "node-a": HASH_A, "node-b": HASH_B });
      const cleared = await clearAllNcfgVersionMarkers();
      expect(new Set(cleared)).toEqual(new Set(["node-a", "node-b"]));
      expect(store.snapshot()).toEqual({});
    });

    it("returns [] on an empty blob", async () => {
      mockMarkerStore({});
      const cleared = await clearAllNcfgVersionMarkers();
      expect(cleared).toEqual([]);
    });
  });

  describe("listTrackedNodeIds", () => {
    it("returns every currently-markered node id", async () => {
      mockMarkerStore({ "node-a": HASH_A, "node-b": HASH_B });
      const ids = await listTrackedNodeIds();
      expect(new Set(ids)).toEqual(new Set(["node-a", "node-b"]));
    });
  });
});
