import { type Oklch, parseColorRef, type ShadeStep, type ThemeTokens } from "@webforge/model";

/** Each shade's OKLCH lightness, lightest first, as Tailwind's own palettes run. */
const SHADE_LIGHTNESS: Readonly<Record<ShadeStep, number>> = {
  50: 0.97,
  100: 0.94,
  200: 0.88,
  300: 0.8,
  400: 0.71,
  500: 0.62,
  600: 0.53,
  700: 0.45,
  800: 0.38,
  900: 0.31,
  950: 0.23,
};

/** How much of the colour's chroma each shade keeps: less at the light and dark ends. */
const SHADE_CHROMA: Readonly<Record<ShadeStep, number>> = {
  50: 0.25,
  100: 0.4,
  200: 0.6,
  300: 0.8,
  400: 0.95,
  500: 1,
  600: 1,
  700: 0.95,
  800: 0.85,
  900: 0.75,
  950: 0.6,
};

/** `color`'s shade `step` (2.1): its hue, a fixed lightness, its chroma scaled for that lightness. */
export function shadeOf(color: Oklch, step: ShadeStep): Oklch {
  return { l: SHADE_LIGHTNESS[step], c: color.c * SHADE_CHROMA[step], h: color.h };
}

/** A colour as a screen shows it: gamma-encoded sRGB channels from 0 to 1. */
export type Srgb = { readonly r: number; readonly g: number; readonly b: number };

/** Linear sRGB channel `value` gamma-encoded, clipped to what a screen shows. */
const encode = (value: number) => {
  const clipped = Math.min(1, Math.max(0, value));
  return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
};

/** Gamma-encoded sRGB channel `value` back to linear light. */
const decode = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

/** `color` in sRGB (through OKLab), clipped to what a screen shows: for swatches and contrast. */
export function oklchToSrgb({ l, c, h }: Oklch): Srgb {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: encode(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short),
    g: encode(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short),
    b: encode(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short),
  };
}

/** The relative luminance (WCAG 2) of a gamma-encoded sRGB colour. */
const luminance = ({ r, g, b }: Srgb) =>
  0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);

/** The WCAG 2 contrast ratio of two gamma-encoded sRGB colours, from 1 (none) to 21. */
export function srgbContrast(one: Srgb, other: Srgb): number {
  const [a, b] = [luminance(one), luminance(other)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The WCAG 2 contrast ratio of `foreground` on `background`, from 1 (none) to 21 (black on white).
 * A foreground at `opacity` (0–1) is first laid over the background, as a browser draws it.
 */
export function contrastRatio(foreground: Oklch, background: Oklch, opacity = 1): number {
  const under = oklchToSrgb(background);
  const over = oklchToSrgb(foreground);
  const mix = (top: number, bottom: number) => top * opacity + bottom * (1 - opacity);
  const front = luminance({
    r: mix(over.r, under.r),
    g: mix(over.g, under.g),
    b: mix(over.b, under.b),
  });
  const back = luminance(under);
  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

/** A `#rrggbb` colour (sRGB, as an arbitrary class writes it) in OKLCH, through OKLab. */
export function hexToOklch(hex: string): Oklch {
  const channel = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return rgbToOklch(channel(1), channel(3), channel(5));
}

/** An sRGB colour, each channel 0–255 (a pixel's), in OKLCH, through OKLab. */
export function rgbToOklch(red: number, green: number, blue: number): Oklch {
  const [r, g, b] = [red, green, blue].map((channel) => decode(channel / 255)) as [
    number,
    number,
    number,
  ];
  const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const medium = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const short = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const l = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short;
  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
  const bLab = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;
  const h = (Math.atan2(bLab, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, bLab), h: h < 0 ? h + 360 : h };
}

/**
 * What colour ref `ref` (a colour style field's value, `@webforge/model`'s `parseColorRef`) shows
 * with `tokens`, in its page colours or those of inverse sections: the colour, and its opacity
 * from 0 to 1. A field's own hex colour is the same everywhere. Undefined for a ref that isn't one.
 */
export function resolveColorRef(
  tokens: ThemeTokens,
  ref: string,
  palette: "colors" | "inverse" = "colors",
): { readonly color: Oklch; readonly opacity: number } | undefined {
  const parsed = parseColorRef(ref);
  if (parsed === undefined) return undefined;
  const colors = palette === "inverse" ? inverseColors(tokens) : tokens.colors;
  const base = "role" in parsed.base ? colors[parsed.base.role] : hexToOklch(parsed.base.hex);
  return {
    color: parsed.shade === undefined ? base : shadeOf(base, parsed.shade),
    opacity: (parsed.opacity ?? 100) / 100,
  };
}

/**
 * The colours of sections that invert the page (2.4): the theme's own, or, for a theme without
 * them, its colours with `neutral` as the surface and `neutral-content` as the text.
 */
export function inverseColors(tokens: ThemeTokens): ThemeTokens["colors"] {
  if (tokens.inverse !== undefined) return tokens.inverse;
  const { neutral, "neutral-content": text } = tokens.colors;
  return {
    ...tokens.colors,
    "base-100": neutral,
    "base-200": neutral,
    "base-300": neutral,
    "base-content": text,
  };
}
