import { describe, expect, it } from "vitest";
import { drawPlaceholder, hex, MOTIFS, placeholderPng } from "./template-placeholder.js";

const spec = {
  width: 64,
  height: 48,
  seed: 7,
  colours: [hex("#f1f1ef"), hex("#1f3a33"), hex("#3d7a66"), hex("#d8c9a8")],
} as const;

/** The width and height a PNG's header says it has. */
function size(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("template placeholders (2.15, Q6 refined)", () => {
  it("draws each motif as a PNG of the size asked", () => {
    for (const motif of MOTIFS) {
      const png = placeholderPng({ ...spec, motif });
      expect([...png.subarray(0, 8)], motif).toEqual([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
      expect(size(png), motif).toEqual({ width: 64, height: 48 });
    }
  });

  it("draws the same picture for the same arguments, and another for another seed", () => {
    const shapes = { ...spec, motif: "shapes" } as const;
    expect(placeholderPng(shapes)).toEqual(placeholderPng(shapes));
    expect(placeholderPng({ ...shapes, seed: 8 })).not.toEqual(placeholderPng(shapes));
  });

  it("draws landscapes and products that differ by seed (2.15b)", () => {
    for (const motif of ["landscape", "product"] as const) {
      const at = (seed: number) => placeholderPng({ ...spec, motif, seed });
      expect(at(1), motif).not.toEqual(at(2));
    }
  });

  it("uses only the colours given, blended at the shapes' edges", () => {
    const pixels = drawPlaceholder({ ...spec, motif: "portrait" });
    // The top-left corner is the background.
    expect([...pixels.subarray(0, 3)]).toEqual([0xf1, 0xf1, 0xef]);
    // The middle of the head is the second shape colour.
    const head = (Math.round(48 * 0.45) * 64 + 32) * 3;
    expect([...pixels.subarray(head, head + 3)]).toEqual([0x3d, 0x7a, 0x66]);
  });

  it("refuses a colour that isn't one", () => {
    expect(() => hex("green")).toThrow("Not a colour");
  });
});
