import { type PageId, type SiteDoc, siteToSnapshot } from "@webforge/model";
import type { CanvasApi } from "../../shared/ipc/canvas.js";
import { classesOfHtml } from "./site-css.js";

/** At most this many classes in one `classCss` call (`MAX_CLASS_CSS`). */
const CLASSES_PER_CALL = 200;

/** One Appearance control's classes on an item, as the control set them (`appearanceClassGroups`). */
export type ClassGroup = {
  readonly field: string;
  readonly classes: string;
  /** Set by its kind's look in the theme (3.12), not by the item itself. */
  readonly fromLook?: boolean;
};

/** What the CSS tab reads (3.14): the canvas styles worker's answers. */
export type ItemCssApi = Pick<CanvasApi, "itemHtml" | "classCss">;

/** An item's CSS, as the tab shows it (3.14). */
export type ItemCssState =
  /** The item as the export writes it, and each of its classes' rules in the site's stylesheet. */
  | {
      readonly status: "ready";
      readonly html: string;
      /** In the order the markup has them; a class that makes no rule is left out. */
      readonly rules: readonly { readonly className: string; readonly css: string }[];
    }
  /** Left out by the export: hidden in Layers (F-ED-12), or in a Header or Footer the page hides. */
  | { readonly status: "hidden" }
  /** The worker couldn't answer, or the item is gone. */
  | { readonly status: "failed" };

/** Each image's size in Media, by id: what the worker names its exported files from. */
function imageSizes(site: SiteDoc): Record<string, { width: number; height: number }> {
  return Object.fromEntries(
    Object.values(site.media).flatMap((item) =>
      item.kind === "image" ? [[item.id, { width: item.width, height: item.height }]] : [],
    ),
  );
}

/**
 * Item `nodeId` of page `pageId` as the export writes it (3.14): its markup, from the canvas styles
 * worker's run of the pipeline, and the rules each of its classes makes in the site's stylesheet,
 * compiled by the same Tailwind the export uses. Reads the document only.
 */
export async function itemCssOf(
  site: SiteDoc,
  pageId: PageId,
  nodeId: string,
  api: ItemCssApi,
): Promise<ItemCssState> {
  const answer = await api.itemHtml({
    snapshot: siteToSnapshot(site, new Map()),
    sizes: imageSizes(site),
    pageId,
    nodeId,
  });
  if (answer.status === "failed" || answer.html === null) return { status: "failed" };
  if (answer.html === "") return { status: "hidden" };
  const classes = [...new Set(classesOfHtml(answer.html))];
  const rules: { className: string; css: string }[] = [];
  for (let start = 0; start < classes.length; start += CLASSES_PER_CALL) {
    const chunk = classes.slice(start, start + CLASSES_PER_CALL);
    const compiled = await api.classCss(site.theme, chunk);
    if (compiled.status === "failed") return { status: "failed" };
    chunk.forEach((className, index) => {
      const css = compiled.css[index];
      if (css !== null && css !== undefined && css.trim() !== "") rules.push({ className, css });
    });
  }
  return { status: "ready", html: answer.html, rules };
}

/** The theme tokens `css` uses: `--color-primary` for `var(--color-primary)`, once each. */
export function tokensIn(css: string): string[] {
  return [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].flatMap((match) => match[1] ?? []))];
}
