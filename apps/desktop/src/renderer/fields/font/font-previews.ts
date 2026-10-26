import { type CatalogueFont, FONT_CATALOGUE } from "@webforge/themes";
import { CANVAS_FONT_URL } from "../../../shared/ipc/canvas.js";

/**
 * The family names fonts are previewed under in the editor: apart from the editor's own fonts and
 * from any the person's computer has, so a preview always shows the app's file.
 */
const PREVIEW_PREFIX = "Webforge preview ";

/** The `font-family` that shows `font` in the editor (its preview's file, then its fallback). */
export const previewFamily = (font: Pick<CatalogueFont, "family" | "fallback">) =>
  `"${PREVIEW_PREFIX}${font.family}", ${font.fallback}`;

/** Whether `file` has regular text: weight 400, or a range that covers it. */
const regular = (weight: CatalogueFont["files"][number]["weight"]) =>
  typeof weight === "number" ? weight === 400 : weight[0] <= 400 && 400 <= weight[1];

/** The one file a font is previewed with: its Latin regular, else the nearest it has. */
function previewFile(font: CatalogueFont) {
  const upright = font.files.filter((file) => file.style === "normal");
  return (
    upright.find((file) => file.subset === "latin" && regular(file.weight)) ??
    upright.find((file) => file.subset === "latin") ??
    upright[0] ??
    font.files[0]
  );
}

/**
 * `@font-face` rules for previewing `fonts` (2.3a): one file each, loaded from the app's own
 * (`webforge-font:`, as the canvas loads them) only once a preview shows the font.
 */
export function fontPreviewCss(fonts: readonly CatalogueFont[] = FONT_CATALOGUE): string {
  return fonts
    .flatMap((font) => {
      const file = previewFile(font);
      if (file === undefined) return [];
      const weight = typeof file.weight === "number" ? file.weight : file.weight.join(" ");
      return [
        [
          "@font-face {",
          `  font-family: "${PREVIEW_PREFIX}${font.family}";`,
          `  src: url("${CANVAS_FONT_URL}${file.file}") format("woff2");`,
          `  font-weight: ${weight};`,
          "  font-style: normal;",
          "  font-display: swap;",
          "}",
        ].join("\n"),
      ];
    })
    .join("\n");
}

/** The style element that holds the previews' rules, once added. */
const STYLE_ID = "webforge-font-previews";

/** Adds the previews' `@font-face` rules to the editor's page, once (they cost nothing unused). */
export function addFontPreviews(document: Document): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = fontPreviewCss();
  document.head.append(style);
}
