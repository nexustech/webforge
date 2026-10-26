import type { ThemeTokens } from "@webforge/model";
import { CURATED_THEMES_A } from "./a.js";
import { CURATED_THEMES_B } from "./b.js";
import { CURATED_THEMES_C } from "./c.js";

/**
 * Webforge's curated themes (2.13, S3): hand-tuned presets with a font pairing, corners, cards,
 * headings, buttons and spacing of their own, each with reversed sections of its own. They come in
 * three batches of four, one file each (2.13a, 2.13b, 2.13c), so the streams that draw them never
 * edit the same one.
 */
export const CURATED_THEMES: readonly ThemeTokens[] = [
  ...CURATED_THEMES_A,
  ...CURATED_THEMES_B,
  ...CURATED_THEMES_C,
];

export { CURATED_THEMES_A, CURATED_THEMES_B, CURATED_THEMES_C };

/**
 * The batches, each the product owner's unit of review (PH2-15): no two themes in one share a
 * heading font style or a colour character, and the themes gallery shows each side by side.
 */
export const CURATED_BATCHES: readonly (readonly ThemeTokens[])[] = [
  CURATED_THEMES_A,
  CURATED_THEMES_B,
  CURATED_THEMES_C,
];
