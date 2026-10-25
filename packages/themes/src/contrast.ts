import type { ColorRole, ThemeTokens } from "@webforge/model";
import { contrastRatio, inverseColors } from "./colors.js";

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
