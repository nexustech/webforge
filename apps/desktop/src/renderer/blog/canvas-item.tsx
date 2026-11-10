import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import {
  collectionOf,
  ITEM_TITLE_FIELD,
  type ItemValue,
  itemValues,
  sameJson,
} from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";
import { hint } from "../site-settings/canvas-settings.js";

type Unsubscribe = () => void;

/** What the canvas shows of the post shown: its values, and its fields' labels for the hints. */
type Shown = {
  readonly values: Readonly<Record<string, ItemValue>>;
  readonly labels: Readonly<Record<string, string>>;
};

/**
 * Shows the fields of the post shown (6.10a, ADR 0025) in its Blog's design on the canvas: its
 * title, date and picture where the design's elements are bound to them, and a hint where one is
 * empty, saying where to fill it in. On a page that isn't a post, a bound element shows its own
 * text, as the export draws it. Drawn again only when what it shows changes: another page shown,
 * or the post's title or fields changed. Not a document change, so no undo step.
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
    };
    if (shown != null && sameJson(next, shown)) return;
    shown = next;
    const { values, labels } = next;
    engine.setItem({
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
