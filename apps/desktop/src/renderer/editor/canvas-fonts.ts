import interRegular from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import interBold from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";
import { CANVAS_FONT_URL } from "../../shared/ipc/canvas.js";

/** The editor's own copies of the fonts exported sites bundle, by file name. */
const FONT_FILES: Readonly<Record<string, string>> = {
  "inter-latin-400-normal.woff2": interRegular,
  "inter-latin-700-normal.woff2": interBold,
};

/** `url("<CANVAS_FONT_URL><file name>")`, as the worker writes it. The prefix has no regex syntax. */
const FONT_REFERENCE = new RegExp(String.raw`url\("${CANVAS_FONT_URL}([^"]+)"\)`, "g");

/**
 * Points the compiled CSS's fonts at the editor's own font files, as absolute URLs: the canvas
 * iframe's document would resolve relative ones against itself. A font the editor doesn't have
 * keeps its placeholder, which loads nothing (the CSP allows fonts from the app only).
 */
export function withCanvasFonts(css: string, baseUrl: string): string {
  return css.replace(FONT_REFERENCE, (reference, fileName: string) => {
    const file = FONT_FILES[fileName];
    return file === undefined ? reference : `url("${new URL(file, baseUrl).href}")`;
  });
}
