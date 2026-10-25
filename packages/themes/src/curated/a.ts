import type { ColorRole, Oklch, ThemeTokens } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";

/** The style tokens of 2.13d as every theme had them, until 2.13d gives each its own. */
const STYLE_AS_BEFORE = {
  headings: { case: "normal", tracking: "normal" },
  cards: { style: "flat" },
  images: { corners: "rounded" },
  sections: { rhythm: "plain" },
} as const satisfies Pick<ThemeTokens, "headings" | "cards" | "images" | "sections">;

/** A colour in OKLCH. */
const ok = (l: number, c: number, h: number): Oklch => ({ l, c, h });
const WHITE = ok(1, 0, 0);

/** The status colours every curated theme shares: they say the same thing on every site. */
const STATUS_ON_LIGHT = {
  info: ok(0.45, 0.14, 245),
  "info-content": WHITE,
  success: ok(0.45, 0.12, 150),
  "success-content": WHITE,
  warning: ok(0.84, 0.15, 85),
  "warning-content": ok(0.2, 0.02, 85),
  error: ok(0.48, 0.19, 27),
  "error-content": WHITE,
} as const satisfies Partial<Record<ColorRole, Oklch>>;
const STATUS_ON_DARK = {
  info: ok(0.78, 0.1, 245),
  "info-content": ok(0.2, 0.03, 245),
  success: ok(0.78, 0.12, 150),
  "success-content": ok(0.2, 0.03, 150),
  warning: ok(0.84, 0.15, 85),
  "warning-content": ok(0.2, 0.02, 85),
  error: ok(0.75, 0.13, 27),
  "error-content": ok(0.2, 0.03, 27),
} as const satisfies Partial<Record<ColorRole, Oklch>>;

/** A curated theme's colours for one palette: its surfaces, text, brand colours and neutral. */
type Palette = {
  readonly surfaces: readonly [Oklch, Oklch, Oklch];
  readonly text: Oklch;
  readonly primary: readonly [Oklch, Oklch];
  readonly secondary: readonly [Oklch, Oklch];
  readonly accent: readonly [Oklch, Oklch];
  readonly neutral: readonly [Oklch, Oklch];
};

/** Every colour role of `palette`, with the shared status colours for its kind of surface. */
function colors(palette: Palette, surface: "light" | "dark"): Record<ColorRole, Oklch> {
  const { surfaces, text, primary, secondary, accent, neutral } = palette;
  return {
    "base-100": surfaces[0],
    "base-200": surfaces[1],
    "base-300": surfaces[2],
    "base-content": text,
    primary: primary[0],
    "primary-content": primary[1],
    secondary: secondary[0],
    "secondary-content": secondary[1],
    accent: accent[0],
    "accent-content": accent[1],
    neutral: neutral[0],
    "neutral-content": neutral[1],
    ...(surface === "light" ? STATUS_ON_LIGHT : STATUS_ON_DARK),
  };
}

/** The default type scale with headings at `weight`, and `h1` at `h1` (the display size). */
function typeScale(
  weight: number,
  h1: ThemeTokens["typeScale"]["h1"]["size"],
): ThemeTokens["typeScale"] {
  const scale = DEFAULT_THEME.typeScale;
  return {
    ...scale,
    h1: { ...scale.h1, size: h1, weight },
    h2: { ...scale.h2, weight },
    h3: { ...scale.h3, weight },
    h4: { ...scale.h4, weight },
    h5: { ...scale.h5, weight },
    h6: { ...scale.h6, weight },
  };
}

/**
 * Bistro: warm and welcoming, for a café, restaurant or bakery. Cream pages, espresso text, a
 * deep green brand colour and terracotta as its second, with Lora's friendly serif headings over Work Sans (the "warm" pairing).
 * Dark sections are espresso with cream text.
 */
const bistro: ThemeTokens = {
  preset: "bistro",
  scheme: "light",
  colors: colors(
    {
      surfaces: [ok(0.975, 0.014, 85), ok(0.945, 0.022, 80), ok(0.905, 0.03, 75)],
      text: ok(0.27, 0.035, 50),
      primary: [ok(0.45, 0.09, 150), WHITE],
      secondary: [ok(0.5, 0.13, 40), WHITE],
      accent: [ok(0.47, 0.09, 75), WHITE],
      neutral: [ok(0.3, 0.035, 50), ok(0.975, 0.014, 85)],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.25, 0.03, 50), ok(0.29, 0.032, 50), ok(0.34, 0.034, 50)],
      text: ok(0.96, 0.016, 85),
      primary: [ok(0.8, 0.08, 150), ok(0.22, 0.03, 150)],
      secondary: [ok(0.76, 0.11, 45), ok(0.22, 0.04, 45)],
      accent: [ok(0.8, 0.09, 75), ok(0.22, 0.03, 75)],
      neutral: [ok(0.92, 0.02, 80), ok(0.25, 0.03, 50)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Lora", fallback: "serif" },
    body: { family: "Work Sans", fallback: "sans-serif" },
  },
  radius: { box: "l", field: "m", selector: "m" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "normal",
  typeScale: typeScale(600, "5xl"),
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "m", style: "filled" },
  shadow: "soft",
  ...STYLE_AS_BEFORE,
};

/**
 * Atelier: light and elegant, for a salon, spa or beauty studio. Ivory pages with a hint of blush,
 * plum text and a dusty-rose brand colour, with Cormorant Garamond's fine headings over Raleway
 * (the "elegant" pairing), pill-shaped outline buttons and roomy spacing. Dark sections are deep
 * plum.
 */
const atelier: ThemeTokens = {
  preset: "atelier",
  scheme: "light",
  colors: colors(
    {
      surfaces: [ok(0.98, 0.008, 20), ok(0.955, 0.016, 15), ok(0.92, 0.024, 12)],
      text: ok(0.28, 0.03, 350),
      primary: [ok(0.45, 0.11, 355), WHITE],
      secondary: [ok(0.44, 0.08, 315), WHITE],
      accent: [ok(0.45, 0.06, 150), WHITE],
      neutral: [ok(0.32, 0.03, 350), ok(0.98, 0.008, 20)],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.26, 0.035, 345), ok(0.3, 0.038, 345), ok(0.35, 0.04, 345)],
      text: ok(0.96, 0.01, 20),
      primary: [ok(0.8, 0.08, 355), ok(0.24, 0.04, 355)],
      secondary: [ok(0.8, 0.07, 315), ok(0.24, 0.04, 315)],
      accent: [ok(0.82, 0.06, 150), ok(0.24, 0.03, 150)],
      neutral: [ok(0.92, 0.015, 20), ok(0.26, 0.035, 345)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Cormorant Garamond", fallback: "serif" },
    body: { family: "Raleway", fallback: "sans-serif" },
  },
  radius: { box: "xl", field: "full", selector: "full" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "roomy",
  typeScale: typeScale(600, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "pill", size: "m", style: "outline" },
  shadow: "none",
  ...STYLE_AS_BEFORE,
};

/**
 * Workshop: sturdy and direct, for builders, electricians and other trades. White pages, navy
 * text and a burnt-orange brand colour (dark enough for white text, and for an outline button's
 * label on white), with Bebas Neue's tall capitals over Roboto (the "bold"
 * pairing), square corners, thick borders, large buttons and compact spacing. Dark sections are
 * navy.
 */
const workshop: ThemeTokens = {
  preset: "workshop",
  scheme: "light",
  colors: colors(
    {
      surfaces: [ok(0.99, 0.002, 250), ok(0.96, 0.006, 250), ok(0.93, 0.01, 250)],
      text: ok(0.22, 0.035, 255),
      primary: [ok(0.52, 0.17, 42), WHITE],
      secondary: [ok(0.32, 0.08, 255), WHITE],
      accent: [ok(0.48, 0.12, 235), WHITE],
      neutral: [ok(0.25, 0.03, 255), WHITE],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.24, 0.045, 255), ok(0.28, 0.05, 255), ok(0.33, 0.055, 255)],
      text: WHITE,
      primary: [ok(0.74, 0.16, 50), ok(0.18, 0.03, 255)],
      secondary: [ok(0.85, 0.05, 255), ok(0.22, 0.04, 255)],
      accent: [ok(0.78, 0.1, 235), ok(0.2, 0.04, 255)],
      neutral: [ok(0.93, 0.005, 250), ok(0.22, 0.035, 255)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Bebas Neue", fallback: "sans-serif" },
    body: { family: "Roboto", fallback: "sans-serif" },
  },
  radius: { box: "none", field: "none", selector: "s" },
  border: "thick",
  effects: { depth: false, noise: false },
  spacing: "compact",
  // Bebas Neue has one weight, and its capitals read a size larger than other fonts'.
  typeScale: typeScale(400, "6xl"),
  links: { underline: "always" },
  buttons: { shape: "square", size: "l", style: "filled" },
  shadow: "strong",
  ...STYLE_AS_BEFORE,
};

/**
 * Clarity: clean and modern, for any business that wants to look professional and calm. White
 * pages, slate text and a clear blue brand colour, with Plus Jakarta Sans headings over DM Sans
 * (the "crisp" pairing) and small, neat corners. Dark sections are deep blue.
 */
const clarity: ThemeTokens = {
  preset: "clarity",
  scheme: "light",
  colors: colors(
    {
      surfaces: [WHITE, ok(0.97, 0.008, 235), ok(0.93, 0.014, 235)],
      text: ok(0.24, 0.03, 255),
      primary: [ok(0.5, 0.14, 250), WHITE],
      secondary: [ok(0.45, 0.14, 285), WHITE],
      accent: [ok(0.48, 0.09, 180), WHITE],
      neutral: [ok(0.28, 0.03, 255), WHITE],
    },
    "light",
  ),
  inverse: colors(
    {
      surfaces: [ok(0.25, 0.05, 260), ok(0.29, 0.055, 260), ok(0.34, 0.06, 260)],
      text: WHITE,
      primary: [ok(0.78, 0.1, 250), ok(0.22, 0.05, 260)],
      secondary: [ok(0.8, 0.09, 285), ok(0.22, 0.05, 285)],
      accent: [ok(0.8, 0.09, 180), ok(0.22, 0.04, 180)],
      neutral: [ok(0.94, 0.01, 235), ok(0.25, 0.05, 260)],
    },
    "dark",
  ),
  fonts: {
    heading: { family: "Plus Jakarta Sans", fallback: "sans-serif" },
    body: { family: "DM Sans", fallback: "sans-serif" },
  },
  radius: { box: "m", field: "s", selector: "s" },
  border: "thin",
  effects: { depth: false, noise: false },
  spacing: "normal",
  typeScale: typeScale(700, "5xl"),
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "m", style: "filled" },
  shadow: "soft",
  ...STYLE_AS_BEFORE,
};

/**
 * Curated themes 1–4 (2.13a, S3): the first batch, which the product owner reviews before the
 * rest, and the themes 2.15a's templates use (Café/Restaurant: Bistro, Salon/Beauty: Atelier,
 * Trades: Workshop). Each sets a light page and dark inverse sections (2.4).
 */
export const CURATED_THEMES_A: readonly ThemeTokens[] = [bistro, atelier, workshop, clarity];
