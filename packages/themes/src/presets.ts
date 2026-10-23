import { copyTheme, DEFAULT_THEME, type ThemeTokens } from "@webforge/model";

/** daisyUI's dark colours, which the light preset keeps for inverse sections. */
const DARK_COLORS = DEFAULT_THEME.inverse ?? DEFAULT_THEME.colors;

/** The light preset's tokens without its inverse colours, for presets that set their own. */
const { inverse: _inverse, ...withoutInverse } = copyTheme(DEFAULT_THEME);

/** A colour in OKLCH. */
const ok = (l: number, c: number, h: number) => ({ l, c, h });
const WHITE = ok(1, 0, 0);
const INK = ok(0.18, 0.01, 265);

/**
 * The starter presets (2.1, S3): three themes that show the range a theme covers, until 2.13's
 * curated themes. `light` is the theme a new site starts with.
 */
export const THEME_PRESETS: readonly ThemeTokens[] = [
  DEFAULT_THEME,
  // Dark pages, and daisyUI's light colours for the sections that invert them.
  {
    ...withoutInverse,
    preset: "dark",
    scheme: "dark",
    colors: { ...DARK_COLORS },
    inverse: { ...DEFAULT_THEME.colors },
  },
  {
    ...withoutInverse,
    preset: "high-contrast-rounded",
    // Text, buttons and brand colours all pass WCAG AA on this theme's surfaces.
    colors: {
      "base-100": WHITE,
      "base-200": ok(0.965, 0, 0),
      "base-300": ok(0.925, 0, 0),
      "base-content": INK,
      primary: ok(0.42, 0.19, 265),
      "primary-content": WHITE,
      secondary: ok(0.42, 0.17, 330),
      "secondary-content": WHITE,
      accent: ok(0.45, 0.1, 180),
      "accent-content": WHITE,
      neutral: ok(0.25, 0.02, 265),
      "neutral-content": WHITE,
      info: ok(0.45, 0.14, 245),
      "info-content": WHITE,
      success: ok(0.45, 0.12, 150),
      "success-content": WHITE,
      warning: ok(0.85, 0.16, 85),
      "warning-content": INK,
      error: ok(0.48, 0.19, 27),
      "error-content": WHITE,
    },
    // Inverse sections: near-black, with light brand colours that pass on it too.
    inverse: {
      "base-100": INK,
      "base-200": ok(0.24, 0.015, 265),
      "base-300": ok(0.3, 0.02, 265),
      "base-content": WHITE,
      primary: ok(0.8, 0.12, 265),
      "primary-content": INK,
      secondary: ok(0.82, 0.1, 330),
      "secondary-content": INK,
      accent: ok(0.82, 0.1, 180),
      "accent-content": INK,
      neutral: ok(0.92, 0, 0),
      "neutral-content": INK,
      info: ok(0.8, 0.1, 245),
      "info-content": INK,
      success: ok(0.8, 0.12, 150),
      "success-content": INK,
      warning: ok(0.85, 0.16, 85),
      "warning-content": INK,
      error: ok(0.78, 0.12, 27),
      "error-content": INK,
    },
    radius: { box: "l", field: "xl", selector: "xl" },
    border: "thick",
    buttons: { shape: "pill", size: "l", style: "filled" },
  },
];

/** The preset named `name`, if there is one. */
export const themePreset = (name: string): ThemeTokens | undefined =>
  THEME_PRESETS.find((preset) => preset.preset === name);
