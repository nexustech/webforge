import { describe, expect, it } from "vitest";
import {
  breakpointOf,
  isOverridden,
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
