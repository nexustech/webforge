import { describe, expect, it } from "vitest";
import {
  areaAt,
  hexToHsv,
  hsvFor,
  hsvToHex,
  moveHue,
  moveInArea,
  parseHex,
  shownHue,
} from "./colour.js";

describe("the colour picker's sums (5.26)", () => {
  it("reads a hex code of three or six digits, with or without its #, and nothing else", () => {
    expect(parseHex("#1A7F5A")).toBe("#1a7f5a");
    expect(parseHex(" 1a7f5a ")).toBe("#1a7f5a");
    expect(parseHex("#fa0")).toBe("#ffaa00");
    for (const text of ["", "#12345", "#1234567", "#ggg000", "red", "#12 456"]) {
      expect(parseHex(text), text).toBeUndefined();
    }
  });

  it("turns a spread of hex codes into hue, saturation and brightness and back unchanged", () => {
    // A spread of codes across the whole range, both ends among them.
    for (let value = 0; value <= 0xffffff; value += 4099) {
      const hex = `#${value.toString(16).padStart(6, "0")}`;
      expect(hsvToHex(hexToHsv(hex)), hex).toBe(hex);
    }
    expect(hsvToHex(hexToHsv("#ffffff"))).toBe("#ffffff");
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00ff00").h).toBe(120);
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
  });

  it("keeps the hue the person left a grey on, while the colour is the same", () => {
    const grey = { h: 200, s: 0, v: 0.5 };
    expect(hsvFor(hsvToHex(grey), grey)).toBe(grey);
    expect(hsvFor("#ff0000", grey)).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvFor("#ff0000", undefined)).toEqual({ h: 0, s: 1, v: 1 });
  });

  it("moves across the area by key: saturation sideways, brightness up and down, 10 with Shift", () => {
    const colour = { h: 30, s: 0.5, v: 0.5 };
    expect(moveInArea(colour, "ArrowRight", false)?.s).toBeCloseTo(0.51);
    expect(moveInArea(colour, "ArrowLeft", true)?.s).toBeCloseTo(0.4);
    expect(moveInArea(colour, "ArrowUp", false)?.v).toBeCloseTo(0.51);
    expect(moveInArea(colour, "ArrowDown", true)?.v).toBeCloseTo(0.4);
    expect(moveInArea(colour, "Home", false)?.s).toBe(0);
    expect(moveInArea(colour, "End", false)?.s).toBe(1);
    expect(moveInArea({ h: 30, s: 1, v: 0 }, "ArrowRight", true)).toEqual({ h: 30, s: 1, v: 0 });
    expect(moveInArea(colour, "a", false)).toBeUndefined();
  });

  it("moves the hue by a degree, 10 with Shift or a page, within 0 and 359", () => {
    const colour = { h: 5, s: 1, v: 1 };
    expect(moveHue(colour, "ArrowRight", false)?.h).toBe(6);
    expect(moveHue(colour, "ArrowDown", true)?.h).toBe(0);
    expect(moveHue(colour, "PageUp", false)?.h).toBe(15);
    expect(moveHue(colour, "End", false)?.h).toBe(359);
    expect(moveHue(colour, "Tab", false)).toBeUndefined();
  });

  it("shows a hue just under 360 as 359, and steps from there, never back past it (#1219)", () => {
    const red = hexToHsv("#ff0001");
    expect(red.h).toBeGreaterThan(359);
    expect(hsvToHex(red)).toBe("#ff0001");
    expect(shownHue(red.h)).toBe(359);
    expect(shownHue(0.4)).toBe(0);
    expect(moveHue(red, "ArrowRight", false)?.h).toBe(359);
    expect(moveHue(red, "ArrowLeft", false)?.h).toBe(358);
    expect(moveHue(red, "PageUp", false)?.h).toBe(359);
  });

  it("reads a point of the area as saturation across and brightness up", () => {
    expect(areaAt({ h: 90, s: 0, v: 0 }, 0.25, 0.25)).toEqual({ h: 90, s: 0.25, v: 0.75 });
    expect(areaAt({ h: 90, s: 0, v: 0 }, -1, 2)).toEqual({ h: 90, s: 0, v: 0 });
  });
});
