import type { ThemeTokens } from "@webforge/model";
import { colors, ok, typeScale, WHITE } from "./palette.js";

/**
 * Bistro: warm and earthy, for a café, restaurant or bakery. Cream pages, espresso text, a muted
 * sage brand colour with terracotta as its second, and Playfair Display's high-contrast serif
 * headings over Source Sans 3 (the "classic" pairing). Generous corners, flat cards, soft photo
 * corners, pill buttons and every second section on a deeper cream. Dark sections are espresso.
 */
const bistro: ThemeTokens = {
  preset: "bistro",
  scheme: "light",
  colors: colors(
    {
      surfaces: [ok(0.975, 0.014, 85), ok(0.94, 0.024, 80), ok(0.9, 0.032, 75)],
      text: ok(0.27, 0.035, 50),
      primary: [ok(0.45, 0.07, 140), WHITE],
      secondary: [ok(0.5, 0.12, 40), WHITE],
      accent: [ok(0.47, 0.08, 80), WHITE],
      neutral: [ok(0.3, 0.035, 50), ok(0.975, 0.014, 85)],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.25, 0.03, 50), ok(0.29, 0.032, 50), ok(0.34, 0.034, 50)],
      text: ok(0.96, 0.016, 85),
      primary: [ok(0.8, 0.07, 140), ok(0.22, 0.03, 140)],
      secondary: [ok(0.76, 0.1, 45), ok(0.22, 0.04, 45)],
      accent: [ok(0.8, 0.08, 80), ok(0.22, 0.03, 80)],
      neutral: [ok(0.92, 0.02, 80), ok(0.25, 0.03, 50)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Playfair Display", fallback: "serif" },
    body: { family: "Source Sans 3", fallback: "sans-serif" },
    accent: { family: "Playfair Display", fallback: "serif" },
  },
  radius: { box: "l", field: "full", selector: "m" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "normal",
  typeScale: typeScale(700, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "pill", size: "m", style: "filled" },
  shadow: "soft",
  headings: { case: "normal", tracking: "tight" },
  cards: { style: "flat" },
  images: { corners: "soft" },
  sections: { rhythm: "alternating" },
};

/**
 * Atelier: dark and refined, for a salon, spa or beauty studio. Near-black plum pages, ivory text
 * and a rose brand colour with champagne as its second, and Montserrat's light geometric headings
 * in widely spaced capitals over Open Sans (the "modern" pairing). Square corners, outlined cards
 * and buttons, square photos and roomy spacing. Its reversed sections are ivory.
 */
const atelier: ThemeTokens = {
  preset: "atelier",
  scheme: "dark",
  colors: colors(
    {
      surfaces: [ok(0.19, 0.015, 340), ok(0.23, 0.018, 340), ok(0.28, 0.02, 340)],
      text: ok(0.94, 0.012, 70),
      primary: [ok(0.78, 0.08, 0), ok(0.2, 0.03, 0)],
      secondary: [ok(0.84, 0.05, 80), ok(0.2, 0.02, 80)],
      accent: [ok(0.76, 0.06, 300), ok(0.2, 0.03, 300)],
      neutral: [ok(0.94, 0.012, 70), ok(0.19, 0.015, 340)],
    },
    "dark",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.97, 0.01, 70), ok(0.94, 0.014, 60), ok(0.9, 0.018, 50)],
      text: ok(0.24, 0.03, 345),
      primary: [ok(0.47, 0.11, 0), WHITE],
      secondary: [ok(0.44, 0.06, 70), WHITE],
      accent: [ok(0.45, 0.08, 300), WHITE],
      neutral: [ok(0.24, 0.03, 345), ok(0.97, 0.01, 70)],
    },
    "light",
  ),
  fonts: {
    heading: { family: "Montserrat", fallback: "sans-serif" },
    body: { family: "Open Sans", fallback: "sans-serif" },
    accent: { family: "Montserrat", fallback: "sans-serif" },
  },
  radius: { box: "none", field: "none", selector: "none" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "roomy",
  typeScale: typeScale(300, "5xl"),
  links: { underline: "always" },
  buttons: { shape: "square", size: "m", style: "outline" },
  shadow: "none",
  headings: { case: "uppercase", tracking: "wide" },
  cards: { style: "outlined" },
  images: { corners: "square" },
  sections: { rhythm: "plain" },
};

/**
 * Workshop: bold and direct, for builders, electricians and other trades. White pages, navy text
 * and a vivid red-orange brand colour, with Bebas Neue's tall condensed capitals over Roboto (the
 * "bold" pairing). Small corners, thick borders, raised cards on strong shadows, large square
 * buttons, compact spacing and every second section on a cool grey. Dark sections are navy.
 */
const workshop: ThemeTokens = {
  preset: "workshop",
  scheme: "light",
  colors: colors(
    {
      surfaces: [WHITE, ok(0.955, 0.008, 250), ok(0.92, 0.012, 250)],
      text: ok(0.22, 0.035, 255),
      primary: [ok(0.52, 0.2, 38), WHITE],
      secondary: [ok(0.32, 0.08, 255), WHITE],
      accent: [ok(0.48, 0.14, 235), WHITE],
      neutral: [ok(0.25, 0.04, 255), WHITE],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.24, 0.045, 255), ok(0.28, 0.05, 255), ok(0.33, 0.055, 255)],
      text: WHITE,
      primary: [ok(0.74, 0.17, 50), ok(0.18, 0.03, 255)],
      secondary: [ok(0.85, 0.05, 255), ok(0.22, 0.04, 255)],
      accent: [ok(0.78, 0.11, 235), ok(0.2, 0.04, 255)],
      neutral: [ok(0.93, 0.005, 250), ok(0.22, 0.035, 255)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Bebas Neue", fallback: "sans-serif" },
    body: { family: "Roboto", fallback: "sans-serif" },
    accent: { family: "Bebas Neue", fallback: "sans-serif" },
  },
  radius: { box: "s", field: "s", selector: "s" },
  border: "thick",
  effects: { depth: false, noise: false },
  spacing: "compact",
  // Bebas Neue has one weight, and its capitals read a size larger than other fonts'.
  typeScale: typeScale(400, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "square", size: "l", style: "filled" },
  shadow: "strong",
  headings: { case: "uppercase", tracking: "wide" },
  cards: { style: "raised" },
  images: { corners: "rounded" },
  sections: { rhythm: "alternating" },
};

/**
 * Clarity: clean and exact, for a consultant, accountant or any service that wants to look
 * professional. Black and white with one cobalt brand colour, and Inter's extra-bold headings,
 * tightly set, over Inter (the "simple" pairing). Neat corners, outlined cards and plain sections.
 * Dark sections are near-black.
 */
const clarity: ThemeTokens = {
  preset: "clarity",
  scheme: "light",
  colors: colors(
    {
      surfaces: [WHITE, ok(0.97, 0, 0), ok(0.925, 0, 0)],
      text: ok(0.2, 0, 0),
      primary: [ok(0.5, 0.2, 262), WHITE],
      secondary: [ok(0.3, 0, 0), WHITE],
      accent: [ok(0.42, 0, 0), WHITE],
      neutral: [ok(0.2, 0, 0), WHITE],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.18, 0, 0), ok(0.22, 0, 0), ok(0.27, 0, 0)],
      text: WHITE,
      primary: [ok(0.78, 0.12, 262), ok(0.2, 0.04, 262)],
      secondary: [ok(0.92, 0, 0), ok(0.2, 0, 0)],
      accent: [ok(0.82, 0, 0), ok(0.2, 0, 0)],
      neutral: [ok(0.95, 0, 0), ok(0.18, 0, 0)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Inter", fallback: "sans-serif" },
    body: { family: "Inter", fallback: "sans-serif" },
    accent: { family: "Inter", fallback: "sans-serif" },
  },
  radius: { box: "m", field: "s", selector: "s" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "normal",
  typeScale: typeScale(800, "5xl"),
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "m", style: "filled" },
  shadow: "soft",
  headings: { case: "normal", tracking: "tight" },
  cards: { style: "outlined" },
  images: { corners: "rounded" },
  sections: { rhythm: "plain" },
};

/**
 * Curated themes 1–4 (2.13a, redone in 2.13d, PH2-15), S3: the first batch, and the themes 2.15a's
 * templates use (Café/Restaurant: Bistro, Salon/Beauty: Atelier, Trades: Workshop). They differ in
 * style, not layout: no two share a heading font style or a colour character (muted, dark-first,
 * vivid, monochrome with one accent), and each has its own corners, cards, headings and spacing.
 * Each sets its own reversed sections (2.4), light under Atelier's dark pages.
 */
export const CURATED_THEMES_A: readonly ThemeTokens[] = [bistro, atelier, workshop, clarity];
