import { describe, expect, it } from "vitest";
import {
  breakpointOf,
  DEVICES,
  differsFromDefault,
  isOverridden,
  sourceOf,
  valueAt,
  withoutOverride,
  withValueAt,
} from "./responsive-value.js";

describe("responsive values in the Edit panel", () => {
  it("maps a canvas view to a device", () => {
    expect(breakpointOf("tablet")).toBe("tablet");
    expect(breakpointOf(1440)).toBe("desktop");
    expect(breakpointOf(1024)).toBe("desktop");
    expect(breakpointOf(1023)).toBe("tablet");
    expect(breakpointOf(800)).toBe("tablet");
    expect(breakpointOf(400)).toBe("mobile");
  });

  it("sets Desktop's value as the base and keeps overrides", () => {
    expect(withValueAt("medium", "desktop", "large")).toBe("large");
    const both = withValueAt("medium", "mobile", "small");
    expect(both).toEqual({ $responsive: { desktop: "medium", mobile: "small" } });
    expect(withValueAt(both, "desktop", "large")).toEqual({
      $responsive: { desktop: "large", mobile: "small" },
    });
  });

  it("shows each device's value, falling back from Mobile to Tablet to Desktop", () => {
    const value = { $responsive: { desktop: "large", tablet: "medium" } };

    expect(valueAt(value, "mobile")).toBe("medium");
    expect(valueAt("small", "tablet")).toBe("small");
    expect(isOverridden(value, "tablet")).toBe(true);
    expect(isOverridden(value, "mobile")).toBe(false);
    expect(isOverridden(value, "desktop")).toBe(false);
    expect(isOverridden("small", "mobile")).toBe(false);
  });

  it("drops an override, and is plain again without any", () => {
    const value = { $responsive: { desktop: "large", tablet: "medium", mobile: "small" } };

    expect(withoutOverride(value, "mobile")).toEqual({
      $responsive: { desktop: "large", tablet: "medium" },
    });
    expect(withoutOverride(withoutOverride(value, "mobile"), "tablet")).toBe("large");
    expect(withoutOverride(value, "desktop")).toBe(value);
    expect(withoutOverride("plain", "mobile")).toBe("plain");
  });
});

describe("differsFromDefault (UX-18)", () => {
  it("counts a value as its default whatever the order of its keys, or a key left undefined (A18)", () => {
    const initial = { type: "page", page: "home", newTab: false };

    expect(
      differsFromDefault({ newTab: false, page: "home", type: "page" }, initial, false, "desktop"),
    ).toBe(false);
    expect(differsFromDefault({ ...initial, anchor: undefined }, initial, false, "desktop")).toBe(
      false,
    );
    expect(differsFromDefault({ ...initial, newTab: true }, initial, false, "desktop")).toBe(true);
    const responsive = { $responsive: { desktop: { a: 1, b: 2 }, mobile: { a: 3 } } };
    expect(differsFromDefault(responsive, { b: 2, a: 1 }, true, "desktop")).toBe(false);
    expect(differsFromDefault(responsive, { b: 2, a: 1 }, true, "mobile")).toBe(true);
  });
});

describe("sourceOf (SP-5)", () => {
  it("names the device whose value applies, as the page resolves it", () => {
    const tabletOnly = { $responsive: { desktop: "l", tablet: "s" } };
    const mobileOnly = { $responsive: { desktop: "l", mobile: "s" } };

    expect(DEVICES.map((at) => sourceOf(tabletOnly, at))).toEqual(["desktop", "tablet", "tablet"]);
    expect(DEVICES.map((at) => sourceOf(mobileOnly, at))).toEqual(["desktop", "desktop", "mobile"]);
    // A value the same on every device is Desktop's.
    expect(sourceOf("m", "mobile")).toBe("desktop");
  });
});
