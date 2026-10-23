import { describe, expect, it } from "vitest";
import { clampWidth, deviceAt, rotatedWidth, snappedWidth } from "./canvas-size.js";

const KIOSK = { id: "k", name: "Kiosk", width: 1080, height: 1920 };

describe("canvas sizes (F-ED-25)", () => {
  it("keeps widths within what the canvas shows", () => {
    expect(clampWidth(100)).toBe(320);
    expect(clampWidth(900.4)).toBe(900);
    expect(clampWidth(9000)).toBe(2560);
  });

  it("rotates a device's width to its height, and back", () => {
    expect(rotatedWidth(375, [])).toBe(812);
    expect(rotatedWidth(812, [])).toBe(375);
    expect(rotatedWidth(768, [])).toBe(1024);
    expect(rotatedWidth(1080, [KIOSK])).toBe(1920);
    expect(rotatedWidth(1920, [KIOSK])).toBe(1080);
    // A width that is no device's can't be rotated.
    expect(rotatedWidth(900, [KIOSK])).toBeUndefined();
  });

  it("snaps a dragged width to the nearest device width within reach, by the zoom", () => {
    // Each edge moves half the width, at the zoom: 12 screen pixels reach 24 CSS pixels at 100%.
    expect(snappedWidth(780, [], 1)).toBe(768);
    expect(snappedWidth(800, [], 1)).toBe(800);
    expect(snappedWidth(800, [], 0.5)).toBe(768);
    expect(snappedWidth(1070, [KIOSK], 1)).toBe(1080);
    expect(snappedWidth(200, [], 1)).toBe(320);
  });

  it("names the device a width is", () => {
    expect(deviceAt(768, [KIOSK])).toEqual({ view: "tablet" });
    expect(deviceAt(1080, [KIOSK])).toEqual({ name: "Kiosk" });
    expect(deviceAt(900, [KIOSK])).toBeUndefined();
  });
});
