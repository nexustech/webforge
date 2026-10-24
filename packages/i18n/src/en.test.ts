import { describe, expect, it } from "vitest";
import { componentFamilies, components } from "./en/components/index.js";
import { areas, en } from "./en.js";

describe("en", () => {
  it("is made of every area's keys, each defined in exactly one area", () => {
    const keys = Object.values(areas).flatMap((area) => Object.keys(area));
    const repeated = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(repeated).toEqual([]);
    expect(Object.keys(en).toSorted()).toEqual(keys.toSorted());
  });

  it("keeps each site component family's strings in its own file, each key in one (2.19)", () => {
    const keys = Object.values(componentFamilies).flatMap((family) => Object.keys(family));
    const repeated = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(repeated).toEqual([]);
    expect(Object.keys(components).toSorted()).toEqual(keys.toSorted());
  });

  it("has no empty messages", () => {
    expect(Object.entries(en).filter(([, message]) => message.trim() === "")).toEqual([]);
  });
});
