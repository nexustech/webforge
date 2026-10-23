import { fontRefSchema } from "@webforge/model";
import { FONT_CATEGORIES, fontIdSchema } from "@webforge/themes/font-plan";
import { z } from "zod";

/** At most this many fonts are listed: Fontsource has about 2,100. */
const MAX_FONTS = 5_000;

/** A font the computer has (2.2): one the installer bundles, or one downloaded once. */
const installedFontSchema = z.strictObject({
  /** Fontsource's id: `playfair-display`. */
  id: fontIdSchema,
  /** The CSS family name, as a theme stores it. */
  family: fontRefSchema.shape.family,
  fallback: fontRefSchema.shape.fallback,
  category: z.enum(FONT_CATEGORIES),
  variable: z.boolean(),
  source: z.enum(["bundled", "downloaded"]),
});

/** A font the computer has. */
export type InstalledFont = z.infer<typeof installedFontSchema>;

/** A font *Browse all fonts* offers (S4): any of Fontsource's the licence filter allows (C1). */
const browsableFontSchema = z.strictObject({
  id: fontIdSchema,
  family: fontRefSchema.shape.family,
  category: z.enum(FONT_CATEGORIES),
  variable: z.boolean(),
  /** Already on this computer: bundled, or downloaded before. */
  installed: z.boolean(),
});

/** A font *Browse all fonts* offers. */
export type BrowsableFont = z.infer<typeof browsableFontSchema>;

/**
 * The fonts there are to download, or why there are none: never reached and nothing kept from an
 * earlier time (`offline`), or anything else.
 */
const browseResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("listed"),
    fonts: z.array(browsableFontSchema).max(MAX_FONTS),
  }),
  z.strictObject({ status: z.literal("failed"), reason: z.enum(["offline", "unknown"]) }),
]);

/** The fonts there are to download. */
export type FontBrowseResult = z.infer<typeof browseResultSchema>;

/**
 * A downloaded font, or why it isn't: Fontsource couldn't be reached (`offline`), its licence or
 * its characters don't let the app use it (`not-allowed`), a file wasn't what its package lists
 * (`damaged`), or anything else.
 */
const downloadResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("downloaded"), font: installedFontSchema }),
  z.strictObject({
    status: z.literal("failed"),
    reason: z.enum(["offline", "not-allowed", "damaged", "unknown"]),
  }),
]);

/** A downloaded font, or why it isn't. */
export type FontDownloadResult = z.infer<typeof downloadResultSchema>;

/** IPC channels of the `fonts` domain (`fonts:*`). */
export const fontsChannels = {
  /** The bundled fonts and the ones downloaded on this computer, for the font picker. */
  listFonts: {
    channel: "fonts:list",
    request: z.tuple([]),
    response: z.array(installedFontSchema).max(MAX_FONTS),
  },
  /** Fontsource's fonts the app may use (*Browse all fonts*); the list is kept for a week. */
  browseFonts: {
    channel: "fonts:browse",
    request: z.tuple([]),
    response: browseResultSchema,
  },
  /**
   * Downloads a font once (PH2-8): its Latin and Latin Extended files, each checked against the
   * SHA-256 its package lists, kept in the user's data so it works offline from then on.
   */
  downloadFont: {
    channel: "fonts:download",
    request: z.tuple([fontIdSchema]),
    response: downloadResultSchema,
  },
} as const;

/** `window.webforge.fonts`. */
export interface FontsApi {
  /** The fonts the computer has: bundled, then downloaded. */
  list(): Promise<InstalledFont[]>;
  /** The fonts there are to download. */
  browse(): Promise<FontBrowseResult>;
  /** Downloads the font with Fontsource id `id`, or answers it at once if the computer has it. */
  download(id: string): Promise<FontDownloadResult>;
}
