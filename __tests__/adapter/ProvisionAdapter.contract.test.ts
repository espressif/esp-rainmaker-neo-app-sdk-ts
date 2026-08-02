/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Adapter contract layer.
 *
 * One shared suite, run against every ProvisionAdapter implementation. Today we
 * only have the in-memory mock; when the native bridges land, add a line per
 * platform here (and provide a JS-reachable factory, e.g. via a React Native
 * test harness):
 *
 *   runProvisionAdapterContract("Android", () => new AndroidProvisionAdapter());
 *   runProvisionAdapterContract("iOS", () => new IosProvisionAdapter());
 *   runProvisionAdapterContract("Web", () => new WebProvisionAdapter());
 *
 * If a platform diverges, this file fails and tells us exactly which invariant
 * broke — before it reaches an app.
 */

import { MockProvisionAdapter } from "../../test-utils/adapter-contract/MockProvisionAdapter";
import { runProvisionAdapterContract } from "../../test-utils/adapter-contract/provisionAdapterContract";

runProvisionAdapterContract("Mock", () => new MockProvisionAdapter(), {
  knownDevicePrefix: "PROV_",
  unknownDeviceId: "NOT_A_REAL_DEVICE",
});
