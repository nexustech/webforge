import { FONT_CATALOGUE, previewFileOf } from "@webforge/themes";
import type { BrowsableFont, FontsApi, InstalledFont } from "../../../shared/ipc/fonts.js";

/** The bundled fonts, as main lists them. */
const BUNDLED: readonly InstalledFont[] = FONT_CATALOGUE.map((font) => {
  const file = previewFileOf(font);
  const preview = file === undefined ? undefined : { file: file.file, weight: file.weight };
  return {
    id: font.id,
    family: font.family,
    fallback: font.fallback,
    category: font.category,
    variable: font.variable,
    source: "bundled" as const,
    ...(preview === undefined ? {} : { preview }),
  };
});

/** A font downloaded on this computer before. */
const DOWNLOADED: InstalledFont = {
  id: "comic-neue",
  family: "Comic Neue",
  fallback: "sans-serif",
  category: "handwriting",
  variable: false,
  source: "downloaded",
  preview: { file: "comic-neue-latin-400-normal.woff2", weight: 400 },
};

/** Fonts *Browse all fonts* finds: one to download, and one the computer has. */
const TO_BROWSE: readonly BrowsableFont[] = [
  { id: "lobster", family: "Lobster", category: "display", variable: false, installed: false },
  {
    id: "comic-neue",
    family: "Comic Neue",
    category: "handwriting",
    variable: false,
    installed: true,
  },
];

/**
 * A stand-in for `window.webforge.fonts` (2.2), for stories and tests: the bundled fonts and one
 * downloaded, a short list to browse, and downloads answered by `download`.
 */
export function fakeFonts(
  download: FontsApi["download"] = (id) =>
    Promise.resolve({
      status: "downloaded",
      font: {
        id,
        family: "Lobster",
        fallback: "sans-serif",
        category: "display",
        variable: false,
        source: "downloaded",
        preview: { file: "lobster-latin-400-normal.woff2", weight: 400 },
      },
    }),
  browse: FontsApi["browse"] = () => Promise.resolve({ status: "listed", fonts: [...TO_BROWSE] }),
): FontsApi {
  return {
    list: () => Promise.resolve([...BUNDLED, DOWNLOADED]),
    browse,
    download,
  };
}
