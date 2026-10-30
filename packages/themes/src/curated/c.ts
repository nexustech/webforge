import type { ThemeTokens } from "@webforge/model";
import { colors, ok, typeScale, WHITE } from "./palette.js";

/**
 * Harbour: dark and calm, for a coastal café, a guesthouse or a studio that works at night. Deep
 * navy pages, pale text, a sea-glass brand colour with sand and coral, and Fraunces's soft serif
 * headings over Inter (the "editorial" pairing). Generous corners, raised cards, pill outline
 * buttons, roomy spacing and every second section a shade lighter. Its reversed sections are pale.
 */
const harbour: ThemeTokens = {
  preset: "harbour",
  scheme: "dark",
  colors: colors(
    {
      surfaces: [ok(0.2, 0.03, 240), ok(0.24, 0.035, 240), ok(0.29, 0.04, 240)],
      text: ok(0.95, 0.01, 200),
      primary: [ok(0.78, 0.1, 185), ok(0.2, 0.03, 240)],
      secondary: [ok(0.84, 0.06, 85), ok(0.2, 0.03, 240)],
      accent: [ok(0.76, 0.1, 35), ok(0.2, 0.03, 240)],
      neutral: [ok(0.95, 0.01, 200), ok(0.2, 0.03, 240)],
    },
    "dark",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.97, 0.01, 200), ok(0.94, 0.015, 200), ok(0.9, 0.02, 200)],
      text: ok(0.24, 0.035, 240),
      primary: [ok(0.45, 0.09, 195), WHITE],
      secondary: [ok(0.46, 0.07, 75), WHITE],
      accent: [ok(0.5, 0.13, 35), WHITE],
      neutral: [ok(0.24, 0.035, 240), ok(0.97, 0.01, 200)],
    },
    "light",
  ),
  fonts: {
    heading: { family: "Fraunces", fallback: "serif" },
    body: { family: "Inter", fallback: "sans-serif" },
    accent: { family: "Fraunces", fallback: "serif" },
  },
  radius: { box: "l", field: "full", selector: "full" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "roomy",
  typeScale: typeScale(600, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "pill", size: "m", style: "outline" },
  shadow: "soft",
  headings: { case: "normal", tracking: "normal" },
  cards: { style: "raised" },
  images: { corners: "soft" },
  sections: { rhythm: "alternating" },
};

/**
 * Linen: quiet and refined, for a florist, a wedding planner or a boutique. Warm linen pages,
 * slate text, a dusty blue brand colour with clay, and Cormorant Garamond's old-style headings in
 * spaced small capitals over Raleway (the "elegant" pairing). Small corners, outlined cards and
 * buttons, square photos and roomy spacing. Dark sections are slate.
 */
const linen: ThemeTokens = {
  preset: "linen",
  scheme: "light",
  colors: colors(
    {
      surfaces: [ok(0.97, 0.012, 75), ok(0.94, 0.018, 75), ok(0.9, 0.022, 75)],
      text: ok(0.28, 0.02, 250),
      primary: [ok(0.45, 0.07, 245), WHITE],
      secondary: [ok(0.47, 0.07, 40), WHITE],
      accent: [ok(0.46, 0.05, 150), WHITE],
      neutral: [ok(0.3, 0.02, 250), ok(0.97, 0.012, 75)],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.27, 0.02, 250), ok(0.31, 0.022, 250), ok(0.36, 0.025, 250)],
      text: ok(0.95, 0.012, 75),
      primary: [ok(0.8, 0.07, 245), ok(0.22, 0.02, 250)],
      secondary: [ok(0.8, 0.07, 45), ok(0.22, 0.02, 250)],
      accent: [ok(0.82, 0.05, 150), ok(0.22, 0.02, 250)],
      neutral: [ok(0.93, 0.012, 75), ok(0.27, 0.02, 250)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Cormorant Garamond", fallback: "serif" },
    body: { family: "Raleway", fallback: "sans-serif" },
    accent: { family: "Cormorant Garamond", fallback: "serif" },
  },
  radius: { box: "s", field: "s", selector: "s" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "roomy",
  typeScale: typeScale(500, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "m", style: "outline" },
  shadow: "none",
  headings: { case: "small-caps", tracking: "wide" },
  cards: { style: "outlined" },
  images: { corners: "square" },
  sections: { rhythm: "plain" },
};

/**
 * Studio: stark and modern, for a CV, a designer or an architect. Black and white with one emerald
 * brand colour, and Plus Jakarta Sans's extra-bold headings in capitals over DM Sans (the "crisp"
 * pairing). Square corners, thick borders, flat cards, square buttons, compact spacing and every
 * second section a pale grey. Dark sections are black.
 */
const studio: ThemeTokens = {
  preset: "studio",
  scheme: "light",
  colors: colors(
    {
      surfaces: [WHITE, ok(0.965, 0, 0), ok(0.92, 0, 0)],
      text: ok(0.17, 0, 0),
      primary: [ok(0.48, 0.13, 160), WHITE],
      secondary: [ok(0.25, 0, 0), WHITE],
      accent: [ok(0.4, 0, 0), WHITE],
      neutral: [ok(0.17, 0, 0), WHITE],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.16, 0, 0), ok(0.2, 0, 0), ok(0.25, 0, 0)],
      text: WHITE,
      primary: [ok(0.8, 0.13, 160), ok(0.18, 0.03, 160)],
      secondary: [ok(0.9, 0, 0), ok(0.17, 0, 0)],
      accent: [ok(0.8, 0, 0), ok(0.17, 0, 0)],
      neutral: [ok(0.95, 0, 0), ok(0.16, 0, 0)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Plus Jakarta Sans", fallback: "sans-serif" },
    body: { family: "DM Sans", fallback: "sans-serif" },
    accent: { family: "Plus Jakarta Sans", fallback: "sans-serif" },
  },
  radius: { box: "none", field: "none", selector: "none" },
  border: "thick",
  effects: { depth: false, noise: false },
  spacing: "compact",
  typeScale: typeScale(800, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "square", size: "m", style: "filled" },
  shadow: "none",
  headings: { case: "uppercase", tracking: "normal" },
  cards: { style: "flat" },
  images: { corners: "square" },
  sections: { rhythm: "alternating" },
};

/**
 * Playground: bright and friendly, for a nursery, a children's club or a party business. White
 * pages, a vivid violet brand colour with tangerine and teal, and Quicksand's rounded headings
 * over Nunito (the "friendly" pairing). Big round corners, raised cards, large pill buttons and
 * soft photos. Dark sections are deep violet.
 */
const playground: ThemeTokens = {
  preset: "playground",
  scheme: "light",
  colors: colors(
    {
      surfaces: [WHITE, ok(0.97, 0.012, 300), ok(0.93, 0.02, 300)],
      text: ok(0.25, 0.04, 290),
      primary: [ok(0.5, 0.21, 295), WHITE],
      secondary: [ok(0.5, 0.16, 48), WHITE],
      accent: [ok(0.5, 0.11, 200), WHITE],
      neutral: [ok(0.28, 0.05, 290), WHITE],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.25, 0.06, 295), ok(0.29, 0.065, 295), ok(0.34, 0.07, 295)],
      text: WHITE,
      primary: [ok(0.8, 0.13, 295), ok(0.22, 0.05, 295)],
      secondary: [ok(0.88, 0.15, 92), ok(0.22, 0.05, 295)],
      accent: [ok(0.8, 0.1, 200), ok(0.22, 0.05, 295)],
      neutral: [ok(0.95, 0.01, 300), ok(0.25, 0.06, 295)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Quicksand", fallback: "sans-serif" },
    body: { family: "Nunito", fallback: "sans-serif" },
    accent: { family: "Quicksand", fallback: "sans-serif" },
  },
  radius: { box: "xl", field: "full", selector: "full" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "normal",
  typeScale: typeScale(700, "5xl"),
  links: { underline: "always" },
  buttons: { shape: "pill", size: "l", style: "filled" },
  shadow: "soft",
  headings: { case: "normal", tracking: "normal" },
  cards: { style: "raised" },
  images: { corners: "soft" },
  sections: { rhythm: "alternating" },
};

/**
 * Curated themes 9–12 (2.13c, S3), the last batch, on the range the product owner approved for
 * themes 1–4 (PH2-15): one dark-first, one muted, one monochrome with one accent and one vivid,
 * each with a heading font of its own kind, and none like 1–4. 2.15c's templates use them
 * (Personal/CV: Studio).
 */
export const CURATED_THEMES_C: readonly ThemeTokens[] = [harbour, linen, studio, playground];
