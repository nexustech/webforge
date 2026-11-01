import { join } from "node:path";
import type { ThemeTokens } from "@webforge/model";
import { type CatalogueFont, FONT_CATALOGUE, fontFacesFor } from "@webforge/themes";
import type { App, Net } from "electron";
import type { ExportJob } from "../shared/export-worker-protocol.js";
import type { AppFeature } from "./app-feature.js";
import { createFontLibrary, type FontLibrary, registerFontHandlers } from "./font-library.js";
import { catalogueFile, createFontReader, createFontResponder, type FontReader } from "./fonts.js";

/** The font files a build of the site gets, read and checked here, and the downloaded families. */
export type ThemeFonts = Pick<ExportJob, "fonts" | "families">;

/** Where the site's fonts come from; fakes in tests. */
export type SiteFontSources = {
  /** The installer's fonts, outside app.asar. */
  readonly bundled: FontReader;
  /** Makes the library of fonts downloaded on demand: once, when first needed. */
  readonly library: () => FontLibrary;
};

/**
 * The site's fonts (2.2, A12): the installer's, and those downloaded on demand into the user's
 * data. Every font file is checked before it's used: the installer's against the catalogue, a
 * downloaded one against what its download measured. A feature for its IPC calls (the `fonts`
 * domain), and what the canvas, an export and the preview read their fonts through.
 */
export function createSiteFonts({ bundled, library }: SiteFontSources) {
  let made: FontLibrary | undefined;
  const downloaded = (): FontLibrary => {
    made ??= library();
    return made;
  };
  const reader: FontReader = {
    read: (face) =>
      catalogueFile(face.file) === undefined ? downloaded().reader.read(face) : bundled.read(face),
  };
  /**
   * The downloaded families `theme` sets its headings, text or accent in: the canvas and an
   * export need them.
   */
  const downloadedFamiliesOf = async (theme: ThemeTokens): Promise<CatalogueFont[]> => {
    const used = Object.values(theme.fonts).map((font) => font.family);
    return (await downloaded().downloaded()).filter((family) => used.includes(family.family));
  };
  /** `theme`'s fonts, and whether every face it uses could be read. */
  const read = async (theme: ThemeTokens): Promise<ThemeFonts & { readonly whole: boolean }> => {
    const families = await downloadedFamiliesOf(theme);
    const faces = fontFacesFor(theme, [...FONT_CATALOGUE, ...families], { accent: true });
    const fonts = faces.flatMap((face) => {
      const data = reader.read(face);
      return data === undefined ? [] : [{ file: face.file, data }];
    });
    return { fonts, families, whole: fonts.length === faces.length };
  };
  // The preview's, read once for the theme's fonts while every face could be read (a family still
  // downloading is read again next time): each edit sends them to its worker again.
  let previewFonts: { readonly key: string; readonly fonts: ThemeFonts } | undefined;
  const register: NonNullable<AppFeature["register"]> = (ipc, isTrustedSender) => {
    registerFontHandlers(ipc, isTrustedSender, downloaded());
  };

  return {
    register,
    /** Answers the editor's `webforge-font:` requests. */
    respondWithFont: createFontResponder(
      reader,
      (name) => catalogueFile(name) ?? downloaded().file(name),
    ),
    downloadedFamiliesOf,
    /**
     * The font files `theme` can use and the downloaded families among them, for an export: the
     * accent font's too (3.22), which the build leaves out when nothing uses it.
     */
    async fontsOf(theme: ThemeTokens): Promise<ThemeFonts> {
      const { fonts, families } = await read(theme);
      return { fonts, families };
    },
    /** {@link fontsOf} for the preview, read again only when the theme's fonts change. */
    async previewFontsOf(theme: ThemeTokens): Promise<ThemeFonts> {
      const key = JSON.stringify(theme.fonts);
      if (previewFonts?.key === key) return previewFonts.fonts;
      const { whole, ...fonts } = await read(theme);
      if (whole) previewFonts = { key, fonts };
      return fonts;
    },
  };
}

/** The site's fonts as the app has them. */
export type SiteFonts = ReturnType<typeof createSiteFonts>;

/** {@link createSiteFonts} from the app's folders, and Electron's `net` for downloads. */
export function siteFontsOf(
  app: Pick<App, "isPackaged" | "getAppPath" | "getPath">,
  net: Pick<Net, "fetch">,
) {
  return createSiteFonts({
    // In the packaged app's resources, or where the build copied them while developing.
    bundled: createFontReader(
      app.isPackaged
        ? join(process.resourcesPath, "fonts")
        : join(app.getAppPath(), "out", "fonts"),
    ),
    library: () =>
      createFontLibrary({
        dir: join(app.getPath("userData"), "fonts"),
        // Looked up at call time, so the E2E tests can stand in for Fontsource, or cut it off.
        fetch: (url, init) => net.fetch(url, init),
      }),
  });
}
