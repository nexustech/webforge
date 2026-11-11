// App icon build (#454): draws the desktop app's icons from the logo's masters in
// `apps/desktop/branding` and writes them where electron-builder looks (`apps/desktop/build`):
//
// - `icon.ico`: Windows, the app, its taskbar button and the installer (16–256 px);
// - `icon.icns`: macOS, the app bundle, the Dock and the DMG (16–1024 px), on Apple's icon grid;
// - `icons/<n>x<n>.png`: Linux (16–512 px).
//
// Usage (run it after changing a master or this file, then commit the result):
//   pnpm app-icons
//
// It also writes `icon-sources.json`, the SHA-256 of the masters and of this file, and a test
// fails when they no longer match: the icons are then older than what they're drawn from. (The
// images themselves aren't compared: rendering may differ by a pixel between platforms.)
//
// Up to 32 px each size is drawn from `icon-small.svg`, which keeps the letters large and the
// flame simple, since the full icon's flame and anvil blur together there; from 48 px, from
// `icon.svg`. Every image is a PNG: Windows reads PNGs inside an `.ico` from Vista on, and macOS
// reads them inside an `.icns` from 10.7.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const DESKTOP = join(import.meta.dirname, "../../apps/desktop");
/** The logo's masters: vector files with the letters outlined, never a font. */
export const BRANDING_DIR = join(DESKTOP, "branding");
/** electron-builder's `buildResources`. */
export const BUILD_DIR = join(DESKTOP, "build");

/** The largest size drawn from the small master. */
export const SMALL_UP_TO = 32;

/** The sizes in the Windows icon. */
export const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;
/** The sizes Linux gets, one PNG each. */
export const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512] as const;
/**
 * The images in the macOS icon, by type: each type is one size, some of them the double-density
 * image of a smaller size (`ic11` is 16 pt at 2x, so 32 px).
 */
export const ICNS_ENTRIES = [
  ["icp4", 16],
  ["icp5", 32],
  ["ic11", 32],
  ["icp6", 64],
  ["ic12", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic13", 256],
  ["ic09", 512],
  ["ic14", 512],
  ["ic10", 1024],
] as const;

/** The two icon masters' SVG. */
export interface Masters {
  readonly full: string;
  readonly small: string;
}

export function readMasters(dir: string = BRANDING_DIR): Masters {
  return {
    full: readFileSync(join(dir, "icon.svg"), "utf8"),
    small: readFileSync(join(dir, "icon-small.svg"), "utf8"),
  };
}

/** The master `size` is drawn from. */
function masterFor(masters: Masters, size: number): string {
  return size <= SMALL_UP_TO ? masters.small : masters.full;
}

/**
 * The masters' letters are outlines, so no font is loaded (#947). By default resvg reads every
 * system font for each drawing: about 200 ms on a developer's machine and up to 6 s on CI's
 * Windows runners, against under 1 ms for the drawing itself.
 */
function render(svg: string, size: number): Uint8Array {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
}

/** The icon at `size` px, its tile filling the square: Windows and Linux. */
export function renderIcon(masters: Masters, size: number): Uint8Array {
  return render(masterFor(masters, size), size);
}

/**
 * The icon at `size` px on Apple's icon grid: the tile 824 of 1024 units wide, centred, with a
 * soft shadow below it, as macOS draws its own apps' icons, so it sits level with them in the
 * Dock.
 */
export function renderMacIcon(masters: Masters, size: number): Uint8Array {
  const master = masterFor(masters, size);
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(master)?.[1];
  if (inner === undefined) throw new Error("A master isn't an SVG document");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><filter id="shadow" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
    <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity="0.3"/>
  </filter></defs>
  <g filter="url(#shadow)">
    <svg x="100" y="100" width="824" height="824" viewBox="0 0 64 64">${inner}</svg>
  </g>
</svg>`;
  return render(svg, size);
}

/** An `.ico` holding `images`, each a square PNG of its size. */
export function encodeIco(images: readonly { size: number; png: Uint8Array }[]): Uint8Array {
  const header = 6;
  const entry = 16;
  let offset = header + entry * images.length;
  const parts: Buffer[] = [];
  const head = Buffer.alloc(header + entry * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  images.forEach(({ size, png }, index) => {
    const at = header + entry * index;
    // 256 is written as 0: the field is one byte.
    head.writeUInt8(size >= 256 ? 0 : size, at);
    head.writeUInt8(size >= 256 ? 0 : size, at + 1);
    head.writeUInt8(0, at + 2);
    head.writeUInt8(0, at + 3);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(png.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += png.length;
    parts.push(Buffer.from(png));
  });
  return Buffer.concat([head, ...parts]);
}

/** An `.icns` holding `entries`, each a PNG under its four-letter type. */
export function encodeIcns(entries: readonly { type: string; png: Uint8Array }[]): Uint8Array {
  const parts = entries.map(({ type, png }) => {
    if (!/^[a-z0-9]{4}$/.test(type)) throw new Error(`Not an icns type: ${type}`);
    const head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, Buffer.from(png)]);
  });
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

/** What the icons are drawn from, with the build that draws them: the record the test checks. */
export const SOURCES = [
  join(BRANDING_DIR, "icon.svg"),
  join(BRANDING_DIR, "icon-small.svg"),
  import.meta.filename,
] as const;

/** The record of {@link SOURCES}: each file's name and its SHA-256, line endings made LF. */
export function sourcesRecord(paths: readonly string[] = SOURCES): string {
  const hashes = Object.fromEntries(
    paths.map((path) => [
      basename(path),
      createHash("sha256")
        .update(readFileSync(path, "utf8").replaceAll("\r\n", "\n"))
        .digest("hex"),
    ]),
  );
  return `${JSON.stringify(hashes, null, 2)}\n`;
}

/** Every icon file, by its path under {@link BUILD_DIR}. */
export function buildAppIcons(masters: Masters): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  files.set(
    "icon.ico",
    encodeIco(ICO_SIZES.map((size) => ({ size, png: renderIcon(masters, size) }))),
  );
  const mac = new Map<number, Uint8Array>();
  files.set(
    "icon.icns",
    encodeIcns(
      ICNS_ENTRIES.map(([type, size]) => {
        const png = mac.get(size) ?? renderMacIcon(masters, size);
        mac.set(size, png);
        return { type, png };
      }),
    ),
  );
  for (const size of LINUX_SIZES) {
    files.set(`icons/${size}x${size}.png`, renderIcon(masters, size));
  }
  return files;
}

if (import.meta.main) {
  const files = buildAppIcons(readMasters());
  for (const [name, bytes] of files) {
    const target = join(BUILD_DIR, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  writeFileSync(join(BUILD_DIR, "icon-sources.json"), sourcesRecord());
  console.log(`Wrote ${files.size} icon files to apps/desktop/build.`);
}
