import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILD_DIR,
  encodeIcns,
  encodeIco,
  ICNS_ENTRIES,
  ICO_SIZES,
  LINUX_SIZES,
  readMasters,
  renderIcon,
  renderMacIcon,
  sourcesRecord,
} from "./build-app-icons.js";

const PNG_SIGNATURE = "89504e470d0a1a0a";

/** A PNG's width and height, from its header. */
function pngSize(png: Buffer): [number, number] {
  expect(png.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

/** The images in an `.ico`: each entry's size and its PNG. */
function readIco(ico: Buffer): { size: number; png: Buffer }[] {
  expect(ico.readUInt16LE(2)).toBe(1);
  return Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const at = 6 + 16 * index;
    const length = ico.readUInt32LE(at + 8);
    const offset = ico.readUInt32LE(at + 12);
    return { size: ico.readUInt8(at) || 256, png: ico.subarray(offset, offset + length) };
  });
}

/** The entries in an `.icns`: each type and its PNG. */
function readIcns(icns: Buffer): { type: string; png: Buffer }[] {
  expect(icns.subarray(0, 4).toString("ascii")).toBe("icns");
  expect(icns.readUInt32BE(4)).toBe(icns.length);
  const entries: { type: string; png: Buffer }[] = [];
  for (let at = 8; at < icns.length; ) {
    const length = icns.readUInt32BE(at + 4);
    entries.push({
      type: icns.subarray(at, at + 4).toString("ascii"),
      png: icns.subarray(at + 8, at + length),
    });
    at += length;
  }
  return entries;
}

describe("the app's icons (#454)", () => {
  // The masters or the build changed without `pnpm app-icons`: the committed icons are stale.
  it("are drawn from the masters as they are now", () => {
    expect(readFileSync(join(BUILD_DIR, "icon-sources.json"), "utf8")).toBe(sourcesRecord());
  });

  it("hold every size Windows asks for, each a PNG of that size", () => {
    const images = readIco(readFileSync(join(BUILD_DIR, "icon.ico")));

    expect(images.map(({ size }) => size)).toEqual([...ICO_SIZES]);
    for (const { size, png } of images) expect(pngSize(png)).toEqual([size, size]);
  });

  it("hold every image macOS asks for, each a PNG of its type's size", () => {
    const entries = readIcns(readFileSync(join(BUILD_DIR, "icon.icns")));

    expect(entries.map(({ type }) => type)).toEqual(ICNS_ENTRIES.map(([type]) => type));
    entries.forEach(({ png }, index) => {
      const size = ICNS_ENTRIES[index]?.[1];
      expect(pngSize(png)).toEqual([size, size]);
    });
  });

  it("hold a PNG for each Linux size", () => {
    for (const size of LINUX_SIZES) {
      expect(pngSize(readFileSync(join(BUILD_DIR, `icons/${size}x${size}.png`)))).toEqual([
        size,
        size,
      ]);
    }
  });
});

describe("drawing the icons", () => {
  const masters = readMasters();

  it("draws each size as a square PNG, for Windows and Linux and on Apple's grid", () => {
    expect(pngSize(Buffer.from(renderIcon(masters, 16)))).toEqual([16, 16]);
    expect(pngSize(Buffer.from(renderIcon(masters, 48)))).toEqual([48, 48]);
    expect(pngSize(Buffer.from(renderMacIcon(masters, 64)))).toEqual([64, 64]);
  });

  it("refuses a master that isn't an SVG document", () => {
    expect(() => renderMacIcon({ full: "<png/>", small: "<png/>" }, 64)).toThrow(/isn't an SVG/);
  });
});

describe("encodeIco", () => {
  it("writes 256 px as 0, the format's one byte, and points each entry at its image", () => {
    const small = Buffer.from("small");
    const large = Buffer.from("large image");
    const ico = Buffer.from(
      encodeIco([
        { size: 16, png: small },
        { size: 256, png: large },
      ]),
    );

    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt8(6 + 16)).toBe(0);
    expect(readIco(ico).map(({ png }) => png.toString())).toEqual(["small", "large image"]);
  });
});

describe("encodeIcns", () => {
  it("writes each entry with its type and length, inside the file's own", () => {
    const icns = Buffer.from(
      encodeIcns([
        { type: "icp4", png: Buffer.from("a") },
        { type: "ic10", png: Buffer.from("bcd") },
      ]),
    );

    expect(icns.length).toBe(8 + 9 + 11);
    expect(readIcns(icns).map(({ type, png }) => [type, png.toString()])).toEqual([
      ["icp4", "a"],
      ["ic10", "bcd"],
    ]);
  });

  it("refuses a type that isn't four letters or digits", () => {
    expect(() => encodeIcns([{ type: "icon5", png: Buffer.from("a") }])).toThrow(/icns type/);
  });
});
