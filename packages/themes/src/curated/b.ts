import type { ThemeTokens } from "@webforge/model";
import { colors, ok, typeScale, WHITE } from "./palette.js";

/**
 * Meridian: calm and trustworthy, for a consultant, a coach or a small practice. Pale stone pages,
 * ink text, a muted petrol-blue brand colour with bronze, and Lora's brushed transitional serif
 * headings over Work Sans (the "warm" pairing). Medium corners, raised cards, rounded photos and
 * every second section a shade deeper. Dark sections are deep petrol.
 */
const meridian: ThemeTokens = {
  preset: "meridian",
  scheme: "light",
  colors: colors(
    {
      surfaces: [ok(0.975, 0.006, 90), ok(0.945, 0.01, 90), ok(0.9, 0.014, 90)],
      text: ok(0.25, 0.02, 240),
      primary: [ok(0.45, 0.07, 215), WHITE],
      secondary: [ok(0.48, 0.06, 60), WHITE],
      accent: [ok(0.47, 0.05, 160), WHITE],
      neutral: [ok(0.27, 0.02, 240), ok(0.975, 0.006, 90)],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.26, 0.03, 225), ok(0.3, 0.033, 225), ok(0.35, 0.036, 225)],
      text: ok(0.96, 0.006, 90),
      primary: [ok(0.82, 0.06, 215), ok(0.22, 0.03, 225)],
      secondary: [ok(0.84, 0.06, 70), ok(0.22, 0.03, 225)],
      accent: [ok(0.83, 0.05, 160), ok(0.22, 0.03, 225)],
      neutral: [ok(0.95, 0.006, 90), ok(0.26, 0.03, 225)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Lora", fallback: "serif" },
    body: { family: "Work Sans", fallback: "sans-serif" },
    accent: { family: "Lora", fallback: "serif" },
  },
  radius: { box: "m", field: "m", selector: "m" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "normal",
  typeScale: typeScale(600, "5xl"),
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "m", style: "filled" },
  shadow: "soft",
  headings: { case: "normal", tracking: "normal" },
  cards: { style: "raised" },
  images: { corners: "rounded" },
  sections: { rhythm: "alternating" },
};

/**
 * Darkroom: quiet and dark, for a photographer, a filmmaker or a portfolio, where the work is
 * what shows. Charcoal pages, warm white text, an amber brand colour, and Space Grotesk's technical
 * headings, tightly set, over Figtree (the "technical" pairing). Small corners, flat cards, square
 * photos, outline buttons and roomy, plain sections. Its reversed sections are pale stone.
 */
const darkroom: ThemeTokens = {
  preset: "darkroom",
  scheme: "dark",
  colors: colors(
    {
      surfaces: [ok(0.18, 0.005, 60), ok(0.22, 0.006, 60), ok(0.27, 0.008, 60)],
      text: ok(0.95, 0.008, 80),
      primary: [ok(0.8, 0.12, 75), ok(0.2, 0.02, 60)],
      secondary: [ok(0.86, 0.02, 80), ok(0.2, 0.01, 60)],
      accent: [ok(0.76, 0.08, 40), ok(0.2, 0.02, 60)],
      neutral: [ok(0.95, 0.008, 80), ok(0.18, 0.005, 60)],
    },
    "dark",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.96, 0.008, 80), ok(0.93, 0.01, 80), ok(0.89, 0.012, 80)],
      text: ok(0.22, 0.006, 60),
      primary: [ok(0.47, 0.1, 65), WHITE],
      secondary: [ok(0.35, 0.01, 60), WHITE],
      accent: [ok(0.5, 0.11, 40), WHITE],
      neutral: [ok(0.22, 0.006, 60), ok(0.96, 0.008, 80)],
    },
    "light",
  ),
  fonts: {
    heading: { family: "Space Grotesk", fallback: "sans-serif" },
    body: { family: "Figtree", fallback: "sans-serif" },
    accent: { family: "Space Grotesk", fallback: "sans-serif" },
  },
  radius: { box: "s", field: "s", selector: "s" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "roomy",
  typeScale: typeScale(500, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "m", style: "outline" },
  shadow: "none",
  headings: { case: "normal", tracking: "tight" },
  cards: { style: "flat" },
  images: { corners: "square" },
  sections: { rhythm: "plain" },
};

/**
 * Market: bright and handmade, for a shop, a market stall or a maker who sells online. White
 * pages, a vivid coral brand colour with leaf green and plum, and Caveat's handwritten headings
 * over Rubik (the "handmade" pairing). Medium corners, raised cards on strong shadows, large
 * rounded buttons and rounded photos. Dark sections are deep berry.
 */
const market: ThemeTokens = {
  preset: "market",
  scheme: "light",
  colors: colors(
    {
      surfaces: [WHITE, ok(0.97, 0.015, 30), ok(0.93, 0.025, 30)],
      text: ok(0.22, 0.03, 20),
      primary: [ok(0.53, 0.2, 25), WHITE],
      secondary: [ok(0.48, 0.13, 150), WHITE],
      accent: [ok(0.48, 0.14, 330), WHITE],
      neutral: [ok(0.24, 0.03, 20), WHITE],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.26, 0.07, 10), ok(0.3, 0.075, 10), ok(0.35, 0.08, 10)],
      text: WHITE,
      primary: [ok(0.8, 0.13, 25), ok(0.22, 0.05, 15)],
      secondary: [ok(0.82, 0.13, 150), ok(0.22, 0.05, 150)],
      accent: [ok(0.82, 0.1, 330), ok(0.22, 0.05, 330)],
      neutral: [ok(0.95, 0.01, 30), ok(0.26, 0.07, 10)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Caveat", fallback: "sans-serif" },
    body: { family: "Rubik", fallback: "sans-serif" },
    accent: { family: "Caveat", fallback: "sans-serif" },
  },
  radius: { box: "m", field: "m", selector: "m" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "compact",
  typeScale: typeScale(700, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "l", style: "filled" },
  shadow: "strong",
  headings: { case: "normal", tracking: "tight" },
  cards: { style: "raised" },
  images: { corners: "rounded" },
  sections: { rhythm: "plain" },
};

/**
 * Gazette: bold and editorial, for a boutique, a jeweller or an independent magazine. Black and
 * white with one tomato-red brand colour, and DM Serif Display's heavy display serif headings over
 * Manrope (the "luxury" pairing). Small corners, thick borders, outlined cards, square buttons and
 * every second section a pale grey. Dark sections are near-black.
 */
const gazette: ThemeTokens = {
  preset: "gazette",
  scheme: "light",
  colors: colors(
    {
      surfaces: [ok(0.985, 0, 0), ok(0.95, 0, 0), ok(0.9, 0, 0)],
      text: ok(0.2, 0, 0),
      primary: [ok(0.5, 0.18, 30), WHITE],
      secondary: [ok(0.3, 0, 0), WHITE],
      accent: [ok(0.45, 0, 0), WHITE],
      neutral: [ok(0.2, 0, 0), WHITE],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.2, 0, 0), ok(0.24, 0, 0), ok(0.29, 0, 0)],
      text: WHITE,
      primary: [ok(0.78, 0.14, 30), ok(0.2, 0.03, 30)],
      secondary: [ok(0.9, 0, 0), ok(0.2, 0, 0)],
      accent: [ok(0.8, 0, 0), ok(0.2, 0, 0)],
      neutral: [ok(0.95, 0, 0), ok(0.2, 0, 0)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "DM Serif Display", fallback: "serif" },
    body: { family: "Manrope", fallback: "sans-serif" },
    accent: { family: "DM Serif Display", fallback: "serif" },
  },
  radius: { box: "s", field: "s", selector: "s" },
  border: "thick",
  effects: { depth: false, noise: false },
  spacing: "normal",
  typeScale: typeScale(400, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "square", size: "m", style: "filled" },
  shadow: "none",
  headings: { case: "normal", tracking: "tight" },
  cards: { style: "outlined" },
  images: { corners: "rounded" },
  sections: { rhythm: "alternating" },
};

/**
 * Curated themes 5–8 (2.13b, S3), on the range the product owner approved for themes 1–4
 * (PH2-15): one muted, one dark-first, one vivid and one monochrome with one accent, each with a
 * heading font of a kind no other batch uses, and none like 1–4 or 9–12. 2.15b's templates use them
 * (Consultant: Meridian, Photographer/Portfolio: Darkroom, Shop: Market).
 */
export const CURATED_THEMES_B: readonly ThemeTokens[] = [meridian, darkroom, market, gazette];
