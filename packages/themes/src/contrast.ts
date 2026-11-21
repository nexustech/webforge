import type { ColorRole, Oklch, ThemeTokens } from "@webforge/model";
import {
  contrastRatio,
  hexOf,
  hexToOklch,
  inverseColors,
  oklchToSrgb,
  ownColorOf,
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

/**
 * The pairs `tokens`' colours are checked in: {@link PAIRS}, and links not always underlined, which
 * stand apart from the text by their colour, the main one: 3:1 against it (WCAG 1.4.1, 2.13a).
 */
const pairsOf = (tokens: ThemeTokens): readonly (readonly [ColorRole, ColorRole, number])[] =>
  tokens.links.underline === "always" ? PAIRS : [...PAIRS, ["base-content", "primary", AA_LARGE]];

/** How far a suggested shade's lightness moves at a time: about a percent of OKLCH's range. */
const SHADE_STEP = 0.01;

/**
 * A shade of page colour `role` that reads with every colour it is paired with (#1174): its hue
 * and chroma (as much as a screen shows) at the nearest lightness, darker or lighter, where none of its pairs is below WCAG
 * AA. What the Theme tab suggests beside a colour that is hard to read. None when it reads
 * already, or when no lightness does.
 * Each shade is checked as a screen shows it, through its hex code: a lightness whose chroma sRGB
 * can't show is clipped (by the export's browser as by `contrastRatio`), and what's suggested is
 * the colour that is checked, never a brighter one whose contrast differs once drawn.
 */
export function readableShade(tokens: ThemeTokens, role: ColorRole): Oklch | undefined {
  const pairs = pairsOf(tokens).filter(([background, foreground]) =>
    [background, foreground].includes(role),
  );
  const reads = (color: Oklch) => {
    const colors = { ...tokens.colors, [role]: color };
    return pairs.every(
      ([background, foreground, required]) =>
        contrastRatio(colors[foreground], colors[background]) >= required,
    );
  };
  const color = tokens.colors[role];
  if (reads(color)) return undefined;
  for (let moved = SHADE_STEP; moved <= 1; moved += SHADE_STEP) {
    for (const l of [color.l - moved, color.l + moved]) {
      if (l < 0 || l > 1) continue;
      const shade = hexToOklch(hexOf({ ...color, l }));
      if (reads(shade)) return shade;
    }
  }
  return undefined;
}

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
  return palettes.flatMap(([palette, colors]) =>
    pairsOf(tokens).flatMap(([background, foreground, required]) => {
      const ratio = contrastRatio(colors[foreground], colors[background]);
      return ratio < required
        ? [{ palette, background, foreground, ratio: Math.floor(ratio * 100) / 100, required }]
        : [];
    }),
  );
}

/**
 * One of the person's own colours (TC-1a, #1217) below WCAG AA on one of the surfaces, in the
 * page's colours or reversed sections'.
 */
export type OwnColorIssue = {
  readonly palette: "colors" | "inverse";
  /** The colour's id: a colour ref names it `own-<id>`. */
  readonly id: string;
  readonly background: "base-100" | "base-200" | "base-300";
  /** Rounded down to two places, as {@link ContrastIssue}'s. */
  readonly ratio: number;
  readonly required: number;
};

/** The surfaces a colour of the person's own is measured on. */
const SURFACES = ["base-100", "base-200", "base-300"] as const;

/**
 * The person's own colours that fail WCAG AA on a surface (TC-1a, #1217), measured as the brand
 * colours other than the main one are: as large text, 3:1, on every surface, in the page's colours
 * and in reversed sections' (their value there worked out from each, `reversedOwnColor`). An empty
 * list: every one passes, or the theme has none.
 */
export function ownColorIssues(tokens: ThemeTokens): OwnColorIssue[] {
  return (["colors", "inverse"] as const).flatMap((palette) => {
    const colors = palette === "inverse" ? inverseColors(tokens) : tokens.colors;
    return (tokens.ownColors ?? []).flatMap(({ id }) => {
      const color = ownColorOf(tokens, id, palette);
      if (color === undefined) return [];
      return SURFACES.flatMap((background) => {
        const ratio = contrastRatio(color, colors[background]);
        return ratio < AA_LARGE
          ? [{ palette, id, background, ratio: Math.floor(ratio * 100) / 100, required: AA_LARGE }]
          : [];
      });
    });
  });
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
