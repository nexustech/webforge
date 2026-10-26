import { FONT_CATALOGUE, previewFileOf } from "@webforge/themes";
import { CANVAS_FONT_URL } from "../../../shared/ipc/canvas.js";

/**
 * The family names fonts are previewed under in the editor: apart from the editor's own fonts and
 * from any the person's computer has, so a preview always shows the app's file.
 */
const PREVIEW_PREFIX = "Webforge preview ";

/** A font the editor can preview: its family, and the file it's previewed with, if it has one. */
export type PreviewFont = { readonly family: string; readonly preview?: string | undefined };

/** The `font-family` that shows `font` in the editor (its preview's file, then its fallback). */
export const previewFamily = (font: { readonly family: string; readonly fallback: string }) =>
  `"${PREVIEW_PREFIX}${font.family}", ${font.fallback}`;

/** The bundled fonts, each with its preview file. */
const BUNDLED: readonly PreviewFont[] = FONT_CATALOGUE.map((font) => ({
  family: font.family,
  preview: previewFileOf(font)?.file,
}));

/**
 * `@font-face` rules for previewing `fonts` (2.3a, 2.3c): one file each, loaded from the app's own
 * (`webforge-font:`, as the canvas loads them, the bundled fonts and those downloaded) only once a
 * preview shows the font. A font without a file has no rule: it shows in its fallback.
 */
export function fontPreviewCss(fonts: readonly PreviewFont[] = BUNDLED): string {
  return fonts
    .flatMap((font) =>
      font.preview === undefined
        ? []
        : [
            [
              "@font-face {",
              `  font-family: "${PREVIEW_PREFIX}${font.family}";`,
              `  src: url("${CANVAS_FONT_URL}${font.preview}") format("woff2");`,
              "  font-display: swap;",
              "}",
            ].join("\n"),
          ],
    )
    .join("\n");
}

/** The style element that holds the previews' rules, once added. */
const STYLE_ID = "webforge-font-previews";

/** The families each previews' style element has rules for. */
const ADDED = new WeakMap<Element, Set<string>>();

/**
 * Adds rules for previewing `fonts` to the editor's page, each family once (they cost nothing
 * unused): the bundled fonts by default, and a font downloaded later as it comes.
 */
export function addFontPreviews(document: Document, fonts: readonly PreviewFont[] = BUNDLED): void {
  let style = document.getElementById(STYLE_ID);
  if (style === null) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.append(style);
  }
  const added = ADDED.get(style) ?? new Set<string>();
  ADDED.set(style, added);
  const fresh = fonts.filter((font) => font.preview !== undefined && !added.has(font.family));
  if (fresh.length === 0) return;
  for (const font of fresh) added.add(font.family);
  style.append(document.createTextNode(fontPreviewCss(fresh)));
}
