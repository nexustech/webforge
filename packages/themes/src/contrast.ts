import type { ColorRole, ThemeTokens } from "@webforge/model";
import {
  contrastRatio,
  inverseColors,
  oklchToSrgb,
  resolveColorRef,
  type Srgb,
  srgbContrast,
} from "./colors.js";

/** WCAG AA: text, and large text or a coloured part (a heading, a button's edge) against its ground. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

/**
 * The colour pairs the components put together (2.1): each role's text on it, text on every
 * surface, the main colour as text on every surface (an outline button's label), and the other
 * brand colours as large text (headings in the theme's colour) on every surface.
 */
const PAIRS: readonly (readonly [ColorRole, ColorRole, number])[] = [
  ["base-100", "base-content", AA_TEXT],
  ["base-200", "base-content", AA_TEXT],
  ["base-300", "base-content", AA_TEXT],
  ["primary", "primary-content", AA_TEXT],
  ["secondary", "secondary-content", AA_TEXT],
  ["accent", "accent-content", AA_TEXT],
  ["neutral", "neutral-content", AA_TEXT],
  ["info", "info-content", AA_TEXT],
  ["success", "success-content", AA_TEXT],
  ["warning", "warning-content", AA_TEXT],
  ["error", "error-content", AA_TEXT],
  // The main colour as text: outline buttons write their label in it (#423, 2.13a).
  ["base-100", "primary", AA_TEXT],
  ["base-100", "secondary", AA_LARGE],
  ["base-100", "accent", AA_LARGE],
  ["base-200", "primary", AA_TEXT],
  ["base-200", "secondary", AA_LARGE],
  ["base-200", "accent", AA_LARGE],
  ["base-300", "primary", AA_TEXT],
  ["base-300", "secondary", AA_LARGE],
  ["base-300", "accent", AA_LARGE],
];

/** A pair of a theme's colours below WCAG AA. */
export type ContrastIssue = {
  /** The page's colours, or those of sections that invert it. */
  readonly palette: "colors" | "inverse";
  readonly background: ColorRole;
  readonly foreground: ColorRole;
  /** The pair's contrast ratio, rounded down to two decimals (so it never shows as passing). */
  readonly ratio: number;
  /** The ratio it needs: 4.5 for text, 3 for large text. */
  readonly required: number;
};

/**
 * The pairs of `tokens`' colours that fail WCAG AA (2.1), in the page's colours and then the
 * inverse sections' (the theme's own, or its fallback), for the Theme panel's contrast warnings
 * (2.3). An empty list: every pair passes.
 */
export function contrastIssues(tokens: ThemeTokens): ContrastIssue[] {
  const palettes = [
    ["colors", tokens.colors],
    ["inverse", inverseColors(tokens)],
  ] as const;
  // Links not always underlined stand apart from the text by their colour, the main one: 3:1
  // against it (WCAG 1.4.1, 2.13a).
  const links: readonly (readonly [ColorRole, ColorRole, number])[] =
    tokens.links.underline === "always" ? [] : [["base-content", "primary", AA_LARGE]];
  return palettes.flatMap(([palette, colors]) =>
    [...PAIRS, ...links].flatMap(([background, foreground, required]) => {
      const ratio = contrastRatio(colors[foreground], colors[background]);
      return ratio < required
        ? [{ palette, background, foreground, ratio: Math.floor(ratio * 100) / 100, required }]
        : [];
    }),
  );
}

/** A section's overlay over its background image (2.26): its colour, how opaque, and its palette. */
export type SectionOverlay = {
  /** The page's background colour (`base-100`) or the neutral one. */
  readonly color: "base" | "neutral";
  /** From 0 (none) to 1. */
  readonly opacity: number;
  /** A section that inverts the page (2.4) has the inverse palette's colours. */
  readonly inverse?: boolean;
  /**
   * The section's own text colour on each device (its Appearance group's Colour, a colour ref),
   * where the person set one; `undefined` for a device whose text is the overlay colour's own.
   * Every one is checked. Without the list, the overlay colour's own text.
   */
  readonly text?: readonly (string | undefined)[];
};

const BLACK: Srgb = { r: 0, g: 0, b: 0 };
const WHITE: Srgb = { r: 1, g: 1, b: 1 };

/** `top` laid over `under` at `opacity` (0–1), as a browser blends it. */
const laidOver = (top: Srgb, opacity: number, under: Srgb): Srgb => ({
  r: top.r * opacity + under.r * (1 - opacity),
  g: top.g * opacity + under.g * (1 - opacity),
  b: top.b * opacity + under.b * (1 - opacity),
});

/**
 * The contrast of a section's text over its overlay (2.26, ST-5), whatever the image under it: the
 * worst of the overlay laid over black and over white, as a browser blends it, for each colour its
 * text has. The text is the section's own colour where the person set one (on any device), else
 * the overlay colour's own: `base-content` on the page colour, `neutral-content` on neutral.
 */
export function overlayContrast(tokens: ThemeTokens, overlay: SectionOverlay): number {
  const palette = overlay.inverse === true ? "inverse" : "colors";
  const colors = palette === "inverse" ? inverseColors(tokens) : tokens.colors;
  const [ground, own] =
    overlay.color === "base"
      ? [colors["base-100"], colors["base-content"]]
      : [colors.neutral, colors["neutral-content"]];
  const over = oklchToSrgb(ground);
  const inks = (overlay.text ?? [undefined]).map((ref) => {
    const set = ref === undefined ? undefined : resolveColorRef(tokens, ref, palette);
    return set ?? { color: own, opacity: 1 };
  });
  return Math.min(
    ...[BLACK, WHITE].flatMap((under) => {
      const behind = laidOver(over, overlay.opacity, under);
      return inks.map((ink) =>
        srgbContrast(laidOver(oklchToSrgb(ink.color), ink.opacity, behind), behind),
      );
    }),
  );
}

/**
 * Whether a section's text can fall below WCAG AA over its overlay, for the Edit panel's warning
 * (reported, never blocking): the ratio, rounded down so it never shows as passing, and the one it
 * needs; `null` when it passes over any image.
 */
export function overlayContrastIssue(
  tokens: ThemeTokens,
  overlay: SectionOverlay,
): { readonly ratio: number; readonly required: number } | null {
  const ratio = overlayContrast(tokens, overlay);
  return ratio < AA_TEXT ? { ratio: Math.floor(ratio * 100) / 100, required: AA_TEXT } : null;
}
