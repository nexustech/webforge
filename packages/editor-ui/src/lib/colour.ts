/**
 * The colour picker's sums (5.26, OL-19): a colour as hue, saturation and brightness (HSV), the
 * picker's area and slider, and as the hex code a person types. No React, so it is tested directly.
 */

/** A colour by hue (0–360), saturation and brightness (each 0–1). */
export type Hsv = { readonly h: number; readonly s: number; readonly v: number };

/** A hex code as the picker takes it: three or six digits, with or without the `#`. */
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * `text` as a colour's six-digit code (`#1a7f5a`), or `undefined` when it isn't one. Three digits
 * stand for six (`#fa0` is `#ffaa00`), as in CSS.
 */
export function parseHex(text: string): string | undefined {
  const digits = HEX.exec(text.trim())?.[1]?.toLowerCase();
  if (digits === undefined) return undefined;
  if (digits.length === 6) return `#${digits}`;
  return `#${[...digits].map((digit) => digit + digit).join("")}`;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** `hex` (as {@link parseHex} gives it) as hue, saturation and brightness. */
export function hexToHsv(hex: string): Hsv {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const range = max - Math.min(r, g, b);
  let h = 0;
  if (range !== 0) {
    if (max === r) h = ((g - b) / range) % 6;
    else if (max === g) h = (b - r) / range + 2;
    else h = (r - g) / range + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : range / max, v: max };
}

/** `colour` as a six-digit hex code. */
export function hsvToHex(colour: Hsv): string {
  const h = ((colour.h % 360) + 360) % 360;
  const s = clamp(colour.s, 0, 1);
  const v = clamp(colour.v, 0, 1);
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const level = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(level * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

/**
 * The colour the picker shows for `hex`: `held` while it is the same colour, so a grey or black
 * keeps the hue the person left it on, which its code can't say; else `hex`'s own.
 */
export function hsvFor(hex: string, held: Hsv | undefined): Hsv {
  return held !== undefined && hsvToHex(held) === hex ? held : hexToHsv(hex);
}

/** How far one press of an arrow key moves: 1% (or a degree of hue), 10 with Shift. */
const STEP = 0.01;
const BIG_STEP = 0.1;

/**
 * `colour` after `key` on the picker's area (saturation left and right, brightness up and down),
 * or `undefined` for a key it doesn't take. Home and End go to no saturation and full.
 */
export function moveInArea(colour: Hsv, key: string, shift: boolean): Hsv | undefined {
  const step = shift ? BIG_STEP : STEP;
  switch (key) {
    case "ArrowLeft":
      return { ...colour, s: clamp(colour.s - step, 0, 1) };
    case "ArrowRight":
      return { ...colour, s: clamp(colour.s + step, 0, 1) };
    case "ArrowUp":
      return { ...colour, v: clamp(colour.v + step, 0, 1) };
    case "ArrowDown":
      return { ...colour, v: clamp(colour.v - step, 0, 1) };
    case "Home":
      return { ...colour, s: 0 };
    case "End":
      return { ...colour, s: 1 };
    default:
      return undefined;
  }
}

/**
 * `hue` as the hue slider shows it, a whole degree from 0 to 359. A code's own hue can lie between
 * 359 and 360 (`#ff0001` is 359.76), which is kept, so the code comes back the same; it shows, and
 * steps, from 359.
 */
export function shownHue(hue: number): number {
  return Math.min(359, Math.round(hue));
}

/**
 * `colour` after `key` on the hue slider: a degree a press, 10 with Shift or Page Up and Down,
 * Home and End to either end; `undefined` for a key it doesn't take. Each step is from the hue
 * shown ({@link shownHue}), so a press never moves it the other way.
 */
export function moveHue(colour: Hsv, key: string, shift: boolean): Hsv | undefined {
  const step = shift ? 10 : 1;
  const from = shownHue(colour.h);
  const at = (h: number) => ({ ...colour, h: clamp(h, 0, 359) });
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return at(from - step);
    case "ArrowRight":
    case "ArrowUp":
      return at(from + step);
    case "PageDown":
      return at(from - 10);
    case "PageUp":
      return at(from + 10);
    case "Home":
      return at(0);
    case "End":
      return at(359);
    default:
      return undefined;
  }
}

/** The area's point at `x`, `y` (each 0–1 across and down it) for `colour`'s hue. */
export function areaAt(colour: Hsv, x: number, y: number): Hsv {
  return { h: colour.h, s: clamp(x, 0, 1), v: clamp(1 - y, 0, 1) };
}
