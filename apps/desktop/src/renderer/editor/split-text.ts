import type { TextSplit } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { pageAnchors, pastedCopies } from "@webforge/model";
import { type LayersSession, layerItem, placeOf } from "../layers/layers.js";
import { shownLayout } from "./shared-layout.js";

/**
 * Splits rich text in two at the caret (Alt + Enter, F-ED-27), as one step ("Split Text"): the
 * element keeps what came before the caret, and a copy of it, with ids and anchors of its own,
 * takes what came after, just after it. The copy is selected. Only the page's own elements split:
 * one in the shared Header or Footer, or inside a linked copy, is shown on other pages too, so
 * `notify` says why not. Returns the copy's id, or undefined if nothing was split.
 */
export function splitText(
  session: LayersSession,
  split: TextSplit,
  notify: (message: string) => void,
): string | undefined {
  const site = session.history.document.getState();
  const ui = session.ui.getState();
  const content = site.pages[ui.pageId]?.doc.content;
  const place = content === undefined ? undefined : placeOf(content, split.nodeId, session.library);
  const node = place?.list[place.index];
  if (content === undefined || node === undefined) {
    notify(t("canvas.splitText.notHere"));
    return undefined;
  }
  const anchors = pageAnchors(content, site.sharedSections, shownLayout(site, ui.pageId));
  const [copy] = pastedCopies([node], anchors);
  if (copy === undefined) {
    return undefined;
  }
  const after = { ...copy, props: { ...copy.props, [split.field]: split.after } };
  const kind = session.library.components[node.type]?.label ?? node.type;
  const name = node.props.layerName;
  const item = layerItem({ kind, name: typeof name === "string" ? name : undefined });
  session.edit(
    "insert",
    t("history.splitText", { item }),
    (draft) => {
      const list = draft.pages[ui.pageId]?.doc.content;
      const at = list === undefined ? undefined : placeOf(list, split.nodeId, session.library);
      const target = at?.list[at.index];
      if (at === undefined || target === undefined) return;
      target.props[split.field] = split.before;
      at.list.splice(at.index + 1, 0, after);
    },
    { selectionAfter: { ...ui, nodeId: after.props.id } },
  );
  session.ui.setState({ nodeId: after.props.id });
  return after.props.id;
}
