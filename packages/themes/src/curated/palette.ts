// What every curated theme's palette is made with (2.13): its colours by OKLCH, the status colours
// they all share, and the type scale they start from. Each batch's file (a.ts, b.ts, c.ts) uses
// them, so no two streams edit the same file.

import type { ColorRole, Oklch, ThemeTokens } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";

/** A colour in OKLCH. */
export const ok = (l: number, c: number, h: number): Oklch => ({ l, c, h });
export const WHITE = ok(1, 0, 0);

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
export type Palette = {
  readonly surfaces: readonly [Oklch, Oklch, Oklch];
  readonly text: Oklch;
  readonly primary: readonly [Oklch, Oklch];
  readonly secondary: readonly [Oklch, Oklch];
  readonly accent: readonly [Oklch, Oklch];
  readonly neutral: readonly [Oklch, Oklch];
};

/** Every colour role of `palette`, with the shared status colours for its kind of surface. */
export function colors(palette: Palette, surface: "light" | "dark"): Record<ColorRole, Oklch> {
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
export function typeScale(
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
