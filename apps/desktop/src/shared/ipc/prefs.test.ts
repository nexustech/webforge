import { describe, expect, it } from "vitest";
import {
  applyPreferencesChange,
  DEFAULT_PREFERENCES,
  INTERFACE_ZOOM_LEVELS,
  interfaceZoomStep,
  preferencesSchema,
} from "./prefs.js";

describe("interfaceZoomStep", () => {
  it("goes one level in or out, staying at either end", () => {
    expect(interfaceZoomStep(1, "in")).toBe(1.1);
    expect(interfaceZoomStep(1.25, "in")).toBe(1.5);
    expect(interfaceZoomStep(1.5, "in")).toBe(1.5);
    expect(interfaceZoomStep(1, "out")).toBe(0.9);
    expect(interfaceZoomStep(0.8, "out")).toBe(0.8);
  });

  it("goes to the next level from a zoom between levels", () => {
    expect(interfaceZoomStep(1.2, "in")).toBe(1.25);
    expect(interfaceZoomStep(1.2, "out")).toBe(1.1);
  });

  it("has 100% among its levels, smallest first", () => {
    expect(INTERFACE_ZOOM_LEVELS).toContain(1);
    expect(INTERFACE_ZOOM_LEVELS).toEqual(INTERFACE_ZOOM_LEVELS.toSorted((a, b) => a - b));
  });
});

describe("interfaceZoom", () => {
  it("is 100% by default, and only one of the levels is valid", () => {
    expect(DEFAULT_PREFERENCES.interfaceZoom).toBe(1);
    expect(preferencesSchema.shape.interfaceZoom.safeParse(1.1).success).toBe(true);
    expect(preferencesSchema.shape.interfaceZoom.safeParse(1.2).success).toBe(false);
    expect(preferencesSchema.shape.interfaceZoom.safeParse(4).success).toBe(false);
  });

  it("changes with the other preferences left as they are", () => {
    const changed = applyPreferencesChange(DEFAULT_PREFERENCES, { interfaceZoom: 1.25 });
    expect(changed).toEqual({ ...DEFAULT_PREFERENCES, interfaceZoom: 1.25 });
    expect(applyPreferencesChange(changed, { theme: "light" }).interfaceZoom).toBe(1.25);
  });
});
