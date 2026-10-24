import type { TextSplit } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { pageAnchors, pastedCopies } from "@webforge/model";
import { quotedElementName } from "./labels.js";
import { type LayersSession, placeOf } from "./layers.js";
import { shownLayout } from "./shared-layout.js";

/**
 * Splits rich text in two at the caret (Alt + Enter, F-ED-27), as one step ("Split Text"): the
 * element keeps what came before the caret, and a copy of it, with ids and anchors of its own,
 * takes what came after, just after it. The copy's other texts start as the component's defaults
 * (a FAQ question split in its answer gets a new question, not the same one again). The copy is
 * selected. Only the page's own elements split:
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
  const fields = session.library.components[node.type]?.fields ?? {};
  const defaults = session.library.components[node.type]?.defaults ?? {};
  const otherTexts = Object.entries(fields)
    .filter(
      ([name, def]) => name !== split.field && (def.kind === "text" || def.kind === "richtext"),
    )
    .map(([name]) => [name, defaults[name]] as const);
  const after = {
    ...copy,
    props: { ...copy.props, ...Object.fromEntries(otherTexts), [split.field]: split.after },
  };
  const item = quotedElementName(node, session.library);
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
    { selectionAfter: { ...ui, nodeId: after.props.id, others: [] }, apply: true },
  );
  return after.props.id;
}
