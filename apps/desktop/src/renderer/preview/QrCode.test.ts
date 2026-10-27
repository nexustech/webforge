import { describe, expect, it } from "vitest";
import { qrPath } from "./QrCode.js";

const URL_TEXT =
  "http://192.168.1.23:52114/4f9c2a7e1b6d3f08a5c7e9b2d4f6a8c0/services/our-cakes.html";

describe("qrPath (3.2)", () => {
  it("draws the code inside its quiet zone of four modules, the finder's corner first", () => {
    const { size, path } = qrPath(URL_TEXT);
    // A version's modules (4n + 17) and four on each side.
    expect((size - 8 - 17) % 4).toBe(0);
    // The top-left finder pattern starts where the quiet zone ends.
    expect(path.startsWith("M4 4h1v1h-1z")).toBe(true);
    // Nothing in the quiet zone.
    const squares = [...path.matchAll(/M(\d+) (\d+)/g)].map(([, x, y]) => [Number(x), Number(y)]);
    expect(
      squares.every(([x = 0, y = 0]) => x >= 4 && y >= 4 && x < size - 4 && y < size - 4),
    ).toBe(true);
  });

  it("draws the same address the same way, and another differently", () => {
    expect(qrPath(URL_TEXT)).toEqual(qrPath(URL_TEXT));
    expect(qrPath(`${URL_TEXT}?x`).path).not.toBe(qrPath(URL_TEXT).path);
  });
});
