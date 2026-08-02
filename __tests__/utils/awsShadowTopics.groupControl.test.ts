/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as yaml from "js-yaml";

import {
  buildGroupControlParamsTopic,
  buildShadowGroupWildcardTopics,
  getReportedParamsFromShadowLiveMessage,
} from "../../src/utils/awsShadowTopics";

describe("buildGroupControlParamsTopic", () => {
  it("builds group broadcast topic", () => {
    expect(buildGroupControlParamsTopic("grp1")).toBe(
      "rainmaker/nodes/groups/grp1/control"
    );
  });

  it("builds subgroup topic under the parent group namespace", () => {
    expect(buildGroupControlParamsTopic("home1", "roomA")).toBe(
      "rainmaker/nodes/groups/home1/subgroups/roomA/control"
    );
  });

  it("matches the channel addresses published in the AsyncAPI spec", () => {
    const doc = yaml.load(
      readFileSync(
        join(__dirname, "..", "..", "contracts", "openapi", "MQTT_User.yaml"),
        "utf8"
      )
    ) as { channels: Record<string, { address: string }> };

    const fill = (template: string, params: Record<string, string>) =>
      template.replace(/\{(\w+)\}/g, (_, k) => params[k]);

    expect(buildGroupControlParamsTopic("grp1")).toBe(
      fill(doc.channels.groupControlBroadcast.address, { groupId: "grp1" })
    );
    expect(buildGroupControlParamsTopic("home1", "roomA")).toBe(
      fill(doc.channels.subgroupControlBroadcast.address, {
        groupId: "home1",
        subgroupId: "roomA",
      })
    );
  });
});

describe("buildShadowGroupWildcardTopics", () => {
  it("includes User MQTT API receive topics plus get accepted/rejected", () => {
    expect(buildShadowGroupWildcardTopics("params-g1")).toEqual([
      "$aws/things/+/shadow/name/params-g1/update/documents",
      "$aws/things/+/shadow/name/params-g1/update/delta",
      "$aws/things/+/shadow/name/params-g1/update/accepted",
      "$aws/things/+/shadow/name/params-g1/update/rejected",
      "$aws/things/+/shadow/name/params-g1/get/accepted",
      "$aws/things/+/shadow/name/params-g1/get/rejected",
    ]);
  });
});

describe("getReportedParamsFromShadowLiveMessage", () => {
  it("unwraps current from update/documents payloads", () => {
    const current = { state: { reported: { Light: { power: true } } } };
    expect(
      getReportedParamsFromShadowLiveMessage(
        "$aws/things/n1/shadow/name/params-g1/update/documents",
        { previous: {}, current }
      )
    ).toEqual(current);
  });

  it("returns other payloads unchanged", () => {
    const payload = { state: { reported: { x: 1 } } };
    expect(
      getReportedParamsFromShadowLiveMessage(
        "$aws/things/n1/shadow/name/params-g1/get/accepted",
        payload
      )
    ).toEqual(payload);
  });
});
