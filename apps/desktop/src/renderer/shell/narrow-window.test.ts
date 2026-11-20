import { describe, expect, it } from "vitest";
import { NARROW_WINDOW_PX, sideToClose, startsLeftCollapsed } from "./narrow-window.js";

describe("the side columns in a narrow window (#1166)", () => {
  it("starts the left column as its strip on a first open below 1100 px", () => {
    expect(startsLeftCollapsed(960, false)).toBe(true);
    expect(startsLeftCollapsed(NARROW_WINDOW_PX - 1, false)).toBe(true);
    // Wide enough for both.
    expect(startsLeftCollapsed(NARROW_WINDOW_PX, false)).toBe(false);
    expect(startsLeftCollapsed(1440, false)).toBe(false);
  });

  it("keeps the person's own layout once they've left one, at any width", () => {
    expect(startsLeftCollapsed(960, true)).toBe(false);
  });

  it("folds the other side column when one opens below 1100 px, while it's open", () => {
    expect(sideToClose(960, "left", true)).toBe("right");
    expect(sideToClose(960, "right", true)).toBe("left");
    // Nothing to fold, or room for both.
    expect(sideToClose(960, "left", false)).toBeUndefined();
    expect(sideToClose(1280, "left", true)).toBeUndefined();
  });
});
