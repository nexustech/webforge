// Draws a placeholder photo for a template (2.15, Q6 refined 26 Oct 2026): flat shapes in a few
// colours, made here, never downloaded, so every template can ship before its real CC0 photos are
// chosen. The picture says what kind of photo goes there (a portrait, a landscape, a desk, work),
// and is the same every time for the same arguments.
//
// Usage: node tools/src/template-placeholder.ts <out.png> <width>x<height> <motif> <seed> <colours…>
//   motif: portrait | landscape | desk | shapes; colours: hex, background first (#e8eef2 #1f6f5c …)
//
// Its images.json entry: source "Generated for Webforge by tools/src/template-placeholder.ts
// (<motif>, seed <seed>)", author "Webforge", licence "CC0-1.0".

import { writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

/** What a placeholder shows. */
export const MOTIFS = ["portrait", "landscape", "desk", "shapes"] as const;
type Motif = (typeof MOTIFS)[number];

type Rgb = readonly [number, number, number];

/** A placeholder's size, motif, seed and colours (the background first). */
export type PlaceholderSpec = {
  readonly width: number;
  readonly height: number;
  readonly motif: Motif;
  readonly seed: number;
  readonly colours: readonly Rgb[];
};

/** A shape, in units of the picture's height (so it keeps its look at any width), and its colour. */
type Shape =
  | {
      readonly kind: "circle";
      readonly x: number;
      readonly y: number;
      readonly r: number;
      readonly colour: Rgb;
    }
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly colour: Rgb;
    }
  | {
      readonly kind: "ellipse";
      readonly x: number;
      readonly y: number;
      readonly rx: number;
      readonly ry: number;
      readonly colour: Rgb;
    };

/** `#rrggbb` as RGB. */
export function hex(value: string): Rgb {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (match === null) throw new Error(`Not a colour: ${value}`);
  return [
    Number.parseInt(match[1] ?? "0", 16),
    Number.parseInt(match[2] ?? "0", 16),
    Number.parseInt(match[3] ?? "0", 16),
  ];
}

/** A small seeded random number generator (mulberry32), so a seed always draws the same picture. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The colour at `index`, wrapping round, for motifs that use more colours than were given. */
const colourAt = (colours: readonly Rgb[], index: number): Rgb =>
  colours[index % colours.length] ?? [128, 128, 128];

/** The shapes of `spec`'s motif, back to front; `aspect` is width over height. */
function shapes(spec: PlaceholderSpec, aspect: number): Shape[] {
  const [, a = colourAt(spec.colours, 0), b = a, c = b, d = c] = spec.colours;
  const middle = aspect / 2;
  switch (spec.motif) {
    case "portrait":
      // Head and shoulders, centred: a person's photo goes here.
      return [
        { kind: "rect", x: middle - 0.06, y: 0.5, w: 0.12, h: 0.16, colour: b },
        { kind: "ellipse", x: middle, y: 0.98, rx: 0.4, ry: 0.33, colour: a },
        { kind: "circle", x: middle, y: 0.45, r: 0.15, colour: b },
      ];
    case "landscape":
      return [
        { kind: "circle", x: aspect * 0.72, y: 0.3, r: 0.12, colour: c },
        { kind: "ellipse", x: aspect * 0.25, y: 1.05, rx: aspect * 0.55, ry: 0.42, colour: a },
        { kind: "ellipse", x: aspect * 0.85, y: 1.12, rx: aspect * 0.5, ry: 0.4, colour: b },
      ];
    case "desk":
      // A table, a laptop, a cup and a plant: a workplace.
      return [
        { kind: "rect", x: 0, y: 0.72, w: aspect, h: 0.28, colour: a },
        { kind: "rect", x: middle - 0.3, y: 0.38, w: 0.6, h: 0.32, colour: b },
        { kind: "rect", x: middle - 0.36, y: 0.69, w: 0.72, h: 0.04, colour: b },
        { kind: "rect", x: middle - 0.26, y: 0.42, w: 0.52, h: 0.24, colour: c },
        { kind: "rect", x: aspect * 0.8, y: 0.58, w: 0.08, h: 0.12, colour: d },
        { kind: "rect", x: aspect * 0.12, y: 0.56, w: 0.07, h: 0.14, colour: b },
        { kind: "circle", x: aspect * 0.12 + 0.035, y: 0.5, r: 0.07, colour: d },
      ];
    case "shapes": {
      // Overlapping shapes from the seed: a piece of work, different for every seed.
      const next = random(spec.seed);
      const count = 4 + Math.floor(next() * 3);
      return Array.from({ length: count }, (_, at): Shape => {
        const colour = colourAt(spec.colours, 1 + (at % Math.max(1, spec.colours.length - 1)));
        // Kept to the middle, so the picture is about its shapes, not its background.
        const x = aspect * (0.2 + next() * 0.6);
        const y = 0.2 + next() * 0.6;
        return next() < 0.5
          ? { kind: "circle", x, y, r: 0.15 + next() * 0.2, colour }
          : {
              kind: "rect",
              x: x - 0.25,
              y: y - 0.2,
              w: 0.3 + next() * 0.4,
              h: 0.25 + next() * 0.3,
              colour,
            };
      });
    }
  }
}

/** Whether point (x, y), in height units, is inside `shape`. */
function inside(shape: Shape, x: number, y: number): boolean {
  switch (shape.kind) {
    case "circle":
      return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.r ** 2;
    case "ellipse":
      return ((x - shape.x) / shape.rx) ** 2 + ((y - shape.y) / shape.ry) ** 2 <= 1;
    case "rect":
      return x >= shape.x && x <= shape.x + shape.w && y >= shape.y && y <= shape.y + shape.h;
  }
}

/** Samples per pixel along each axis: edges come out smooth, not stepped. */
const SAMPLES = 3;

/** `spec` drawn as RGB pixels, row by row. */
export function drawPlaceholder(spec: PlaceholderSpec): Uint8Array {
  const { width, height } = spec;
  const background = colourAt(spec.colours, 0);
  const drawn = shapes(spec, width / height);
  const pixels = new Uint8Array(width * height * 3);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (column + (sx + 0.5) / SAMPLES) / height;
          const y = (row + (sy + 0.5) / SAMPLES) / height;
          let colour = background;
          for (const shape of drawn) if (inside(shape, x, y)) colour = shape.colour;
          red += colour[0];
          green += colour[1];
          blue += colour[2];
        }
      }
      const at = (row * width + column) * 3;
      const samples = SAMPLES * SAMPLES;
      pixels[at] = Math.round(red / samples);
      pixels[at + 1] = Math.round(green / samples);
      pixels[at + 2] = Math.round(blue / samples);
    }
  }
  return pixels;
}

/** A PNG chunk: its length, type, data and CRC. */
function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** RGB `pixels` of `width` × `height` as a PNG file. */
function encodePng(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  // Each row starts with its filter: "Up" (2), which flat shapes compress best with.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    raw[row * (stride + 1)] = 2;
    for (let at = 0; at < stride; at++) {
      const value = pixels[row * stride + at] ?? 0;
      const above = row === 0 ? 0 : (pixels[(row - 1) * stride + at] ?? 0);
      raw[row * (stride + 1) + 1 + at] = (value - above) & 0xff;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]);
}

/** `spec` drawn and encoded as a PNG. */
export function placeholderPng(spec: PlaceholderSpec): Uint8Array {
  return encodePng(drawPlaceholder(spec), spec.width, spec.height);
}

if (import.meta.main) {
  const [out, size, motif, seed, ...colours] = process.argv.slice(2);
  const [width, height] = (size ?? "").split("x").map(Number);
  if (
    out === undefined ||
    width === undefined ||
    height === undefined ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    !MOTIFS.includes(motif as Motif) ||
    colours.length === 0
  ) {
    console.error(
      "Usage: node tools/src/template-placeholder.ts <out.png> <w>x<h> <motif> <seed> <colours…>",
    );
    process.exit(1);
  }
  writeFileSync(
    out,
    placeholderPng({
      width,
      height,
      motif: motif as Motif,
      seed: Number(seed),
      colours: colours.map(hex),
    }),
  );
}
