import { describe, expect, it } from "vitest";
import { areas, en } from "./en.js";

describe("en", () => {
  it("is made of every area's keys, each defined in exactly one area", () => {
    const keys = Object.values(areas).flatMap((area) => Object.keys(area));
    const repeated = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(repeated).toEqual([]);
    expect(Object.keys(en).toSorted()).toEqual(keys.toSorted());
  });

  it("has no empty messages", () => {
    expect(Object.entries(en).filter(([, message]) => message.trim() === "")).toEqual([]);
  });
});
