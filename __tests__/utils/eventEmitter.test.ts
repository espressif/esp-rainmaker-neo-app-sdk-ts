/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from "../../src/utils/eventEmitter";

describe("EventEmitter", () => {
  it("should emit to listeners", () => {
    const e = new EventEmitter();
    const fn = jest.fn();
    e.on("params", fn);
    e.emit("params", { a: 1 });
    expect(fn).toHaveBeenCalledWith({ a: 1 });
  });

  it("should off remove listener", () => {
    const e = new EventEmitter();
    const fn = jest.fn();
    e.on("params", fn);
    e.off("params", fn);
    e.emit("params", {});
    expect(fn).not.toHaveBeenCalled();
  });

  it("should removeAllListeners", () => {
    const e = new EventEmitter();
    e.on("params", jest.fn());
    e.removeAllListeners();
    expect(e.emit("params", {})).toBe(false);
  });
});
