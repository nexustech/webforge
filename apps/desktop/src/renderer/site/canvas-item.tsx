import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import {
  collectionOf,
  exportedAddress,
  exportedSiteAddress,
  ITEM_TITLE_FIELD,
  type ItemValue,
  itemValues,
  type PageEntry,
  type PageId,
  pagePath,
  sameJson,
} from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";
import { hint } from "../site-settings/index.js";

type Unsubscribe = () => void;

/** `page`'s address under the site's web address `site`, as the export writes it; none without. */
const addressOf = (site: string | undefined, page: PageEntry, homePageId: PageId) =>
  site === undefined ? undefined : exportedAddress(site, pagePath(page, homePageId));

/**
 * What the canvas shows of the post shown: its values, its fields' labels for the hints, and its
 * address on the web, if the site has one.
 */
type Shown = {
  readonly values: Readonly<Record<string, ItemValue>>;
  readonly labels: Readonly<Record<string, string>>;
  readonly address: string | undefined;
};

/**
 * Shows the fields of the post shown (6.10a, ADR 0025) in its Blog's design on the canvas: its
 * title, date and picture where the design's elements are bound to them, and a hint where one is
 * empty, saying where to fill it in; and its address on the web, which Share buttons share
 * (6.17b). On a page that isn't a post, a bound element shows its own text, as the export draws
 * it. Drawn again only when what it shows changes: another page shown, the post's title, fields or
 * address, or the site's web address. Not a document change, so no undo step.
 */
export function connectCanvasItem(
  engine: Pick<CanvasEngine, "setItem">,
  session: Pick<EditorSession, "history" | "ui">,
): Unsubscribe {
  const { document } = session.history;
  let shown: Shown | null | undefined;
  const show = () => {
    const site = document.getState();
    const page = site.pages[session.ui.getState().pageId];
    const collection = page === undefined ? undefined : collectionOf(site, page);
    if (page === undefined || collection === undefined) {
      if (shown !== null) {
        shown = null;
        engine.setItem({});
      }
      return;
    }
    const next: Shown = {
      values: itemValues(collection, page),
      labels: {
        [ITEM_TITLE_FIELD]: t("blog.binding.title"),
        ...Object.fromEntries(collection.fields.map((field) => [field.name, field.label])),
      },
      address: addressOf(exportedSiteAddress(site.settings.address.url), page, site.homePageId),
    };
    if (shown != null && sameJson(next, shown)) return;
    shown = next;
    const { values, labels, address } = next;
    engine.setItem({
      ...(address === undefined ? {} : { pageAddress: address }),
      item: (field) => (Object.hasOwn(values, field) ? values[field] : undefined),
      emptyItem: (field) =>
        hint(
          t("blog.empty", {
            field: (Object.hasOwn(labels, field) ? labels[field] : field) ?? field,
          }),
        ),
    });
  };
  show();
  const stopDocument = document.subscribe(show);
  const stopUi = session.ui.subscribe(show);
  return () => {
    stopDocument();
    stopUi();
  };
}
