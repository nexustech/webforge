import { describe, expect, it } from "vitest";
import { nextFitLevel } from "./toolbar-fit.js";

describe("nextFitLevel (#1008)", () => {
  it("goes up a level while the content is wider than the toolbar, noting what it needed", () => {
    const needed: number[] = [];
    expect(nextFitLevel(0, { width: 400, content: 700 }, needed, 3)).toBe(1);
    expect(nextFitLevel(1, { width: 400, content: 600 }, needed, 3)).toBe(2);
    expect(needed).toEqual([700, 600]);
  });

  it("stays at the most compact level, however narrow", () => {
    expect(nextFitLevel(3, { width: 200, content: 400 }, [700, 600, 500], 3)).toBe(3);
  });

  it("takes a pixel's overflow as fitting: widths are fractional at some zooms", () => {
    expect(nextFitLevel(0, { width: 400, content: 401 }, [], 3)).toBe(0);
  });

  it("goes back down once there is room for the level below, and not before", () => {
    const needed = [700, 600];
    expect(nextFitLevel(2, { width: 599, content: 599 }, needed, 3)).toBe(2);
    expect(nextFitLevel(2, { width: 600, content: 600 }, needed, 3)).toBe(1);
    expect(nextFitLevel(1, { width: 650, content: 650 }, needed, 3)).toBe(1);
    expect(nextFitLevel(1, { width: 720, content: 720 }, needed, 3)).toBe(0);
  });

  it("stays put while it fits and the level below was never measured", () => {
    expect(nextFitLevel(0, { width: 800, content: 800 }, [], 3)).toBe(0);
    expect(nextFitLevel(1, { width: 800, content: 800 }, [], 3)).toBe(1);
  });
});
