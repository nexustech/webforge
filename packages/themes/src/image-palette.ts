import type { Oklch, ThemeTokens } from "@webforge/model";
import { contrastRatio, rgbToOklch } from "./colors.js";
import { AA_LARGE, AA_TEXT } from "./contrast.js";

/** One of an image's main colours, and how much of the image it covers (0–1). */
export type ImageColour = { readonly color: Oklch; readonly share: number };

/** A colour in OKLab: lightness and the two colour axes, where distances are perceptual. */
type Lab = { readonly l: number; readonly a: number; readonly b: number };

const toLab = ({ l, c, h }: Oklch): Lab => {
  const radians = (h * Math.PI) / 180;
  return { l, a: c * Math.cos(radians), b: c * Math.sin(radians) };
};

const toOklch = ({ l, a, b }: Lab): Oklch => {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
};

const distance = (x: Lab, y: Lab) => (x.l - y.l) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2;

/** The rounds k-means takes; a downscaled image settles well within them. */
const ROUNDS = 12;

/**
 * An image's main colours (PG-2), from its pixels (RGBA, as a canvas gives them, ideally of a
 * downscaled copy): up to `count` colours, the commonest first. Clear pixels (a logo's background)
 * are left out. Computed here, on this computer: nothing is sent anywhere. k-means in OKLab, where
 * distance is how different colours look, started from colours spread across the image's, so the
 * same image always gives the same colours.
 */
export function imageColours(pixels: ArrayLike<number>, count = 6): ImageColour[] {
  const points: Lab[] = [];
  for (let at = 0; at + 3 < pixels.length; at += 4) {
    if ((pixels[at + 3] ?? 0) < 128) continue;
    points.push(toLab(rgbToOklch(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0)));
  }
  if (points.length === 0) return [];
  // The start: the first point, then each time the point furthest from those chosen.
  const centres: Lab[] = [points[0] as Lab];
  while (centres.length < count) {
    let furthest: Lab | undefined;
    let best = 0;
    for (const point of points) {
      const near = Math.min(...centres.map((centre) => distance(point, centre)));
      if (near > best) {
        best = near;
        furthest = point;
      }
    }
    if (furthest === undefined) break;
    centres.push(furthest);
  }
  let members: number[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    members = points.map((point) => {
      let nearest = 0;
      centres.forEach((centre, index) => {
        if (distance(point, centre) < distance(point, centres[nearest] as Lab)) nearest = index;
      });
      return nearest;
    });
    centres.forEach((_, index) => {
      const mine = points.filter((_point, at) => members[at] === index);
      if (mine.length === 0) return;
      const mean = (pick: (lab: Lab) => number) =>
        mine.reduce((sum, lab) => sum + pick(lab), 0) / mine.length;
      centres[index] = {
        l: mean((lab) => lab.l),
        a: mean((lab) => lab.a),
        b: mean((lab) => lab.b),
      };
    });
  }
  return centres
    .map((centre, index) => ({
      color: toOklch(centre),
      share: members.filter((member) => member === index).length / points.length,
    }))
    .filter((colour) => colour.share > 0)
    .sort((a, b) => b.share - a.share);
}

/** The brand colours a palette from an image proposes, each with its text colour. */
export type BrandProposal = Readonly<
  Record<
    "primary" | "primary-content" | "secondary" | "secondary-content" | "accent" | "accent-content",
    Oklch
  >
>;

/** Chroma below which a colour reads as grey: not a brand colour on its own. */
const GREY = 0.04;

/** How far apart two hues must be (degrees) to count as different colours. */
const HUE_APART = 30;

const hueGap = (a: number, b: number) => {
  const gap = Math.abs(a - b) % 360;
  return Math.min(gap, 360 - gap);
};

/** `color`, made light or dark enough in steps, keeping its hue, until `passes` says it does. */
function adjusted(color: Oklch, darker: boolean, passes: (color: Oklch) => boolean): Oklch {
  let next = color;
  for (let step = 0; step < 100 && !passes(next); step += 1) {
    const l = Math.min(1, Math.max(0, next.l + (darker ? -0.01 : 0.01)));
    if (l === next.l) break;
    next = { ...next, l };
  }
  return next;
}

/**
 * `color` as a brand colour on `theme`'s page, with its text: readable as `needed` contrast on the
 * page's surface (the main colour is text on it, outline buttons' labels; the accents are large
 * text), and its text, the lighter or darker of two in its own hue, readable on it (4.5:1).
 */
function asBrand(color: Oklch, theme: ThemeTokens, needed: number): readonly [Oklch, Oklch] {
  const surface = theme.colors["base-100"];
  const darker = theme.scheme === "light";
  const onSurface = adjusted(color, darker, (each) => contrastRatio(each, surface) >= needed);
  const light: Oklch = { l: 0.98, c: Math.min(0.02, color.c), h: color.h };
  const dark: Oklch = { l: 0.22, c: Math.min(0.04, color.c), h: color.h };
  const text = contrastRatio(light, onSurface) >= contrastRatio(dark, onSurface) ? light : dark;
  // Away from its text until the text reads well on it.
  const brand = adjusted(onSurface, text === light, (each) => contrastRatio(text, each) >= AA_TEXT);
  return [brand, text];
}

/**
 * The brand colours an image's main `colours` propose for `theme` (PG-2, F-DS-7): Brand is the
 * commonest colourful one, weighted by how colourful it is; Accent and Second accent the next whose
 * hues differ, or Brand's hue turned for an image with fewer colours (a one-colour logo). Each is
 * then made readable as the contrast guideline asks (WCAG AA, as 2.1 checks the theme), with a text
 * colour of its own. Undefined for an image with no colours (all clear).
 */
export function brandFromImage(
  colours: readonly ImageColour[],
  theme: ThemeTokens,
): BrandProposal | undefined {
  if (colours.length === 0) return undefined;
  const colourful = colours
    .filter((colour) => colour.color.c >= GREY)
    .sort((a, b) => b.share * b.color.c - a.share * a.color.c);
  // A grey or black logo: its darkest colour, as the brand.
  const brand =
    colourful[0]?.color ??
    [...colours].sort((a, b) => a.color.l - b.color.l)[0]?.color ??
    (colours[0] as ImageColour).color;
  const chosen = [brand];
  for (const colour of colourful) {
    if (chosen.length === 3) break;
    if (chosen.every((each) => hueGap(each.h, colour.color.h) >= HUE_APART)) {
      chosen.push(colour.color);
    }
  }
  // Fewer colours than three: Brand's hue turned, a third of the wheel each way.
  const turns = [120, 240];
  while (chosen.length < 3) {
    const turn = turns[chosen.length - 1] ?? 180;
    chosen.push({ l: brand.l, c: Math.max(brand.c, GREY * 2), h: (brand.h + turn) % 360 });
  }
  const [primary, primaryText] = asBrand(chosen[0] as Oklch, theme, AA_TEXT);
  const [secondary, secondaryText] = asBrand(chosen[1] as Oklch, theme, AA_LARGE);
  const [accent, accentText] = asBrand(chosen[2] as Oklch, theme, AA_LARGE);
  return {
    primary,
    "primary-content": primaryText,
    secondary,
    "secondary-content": secondaryText,
    accent,
    "accent-content": accentText,
  };
}
