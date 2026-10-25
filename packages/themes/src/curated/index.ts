import type { ThemeTokens } from "@webforge/model";
import { CURATED_THEMES_A } from "./a.js";

/**
 * Webforge's curated themes (2.13, S3): hand-tuned presets with a font pairing, corner and button
 * style and spacing of their own, each with dark inverse sections. They come in three batches of
 * four, one file each (2.13a, 2.13b, 2.13c), so the streams that draw them never edit the same one.
 */
export const CURATED_THEMES: readonly ThemeTokens[] = [...CURATED_THEMES_A];
