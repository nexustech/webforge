import type { NodeDoc, PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { allNodes } from "./tree.js";

/**
 * Ids of nodes whose rich-text values differ between `before` and `after`. Their editors are
 * remounted so they show the new value (see `toPuckConfig`). That includes the editor the user is
 * typing in: a change from outside it (Undo or Redo pressed while typing) must show, and Puck
 * itself doesn't sync an editor that changed in the last moments (#146).
 */
export function staleRichText(
  library: ComponentLibrary,
  before: PageDoc,
  after: PageDoc,
): string[] {
  const previous = new Map<string, NodeDoc>(allNodes(before).map((node) => [node.props.id, node]));
  return allNodes(after)
    .filter((node) => {
      const fields = library.components[node.type]?.fields;
      if (fields === undefined) {
        return false;
      }
      const old = previous.get(node.props.id);
      return Object.entries(fields).some(
        ([name, field]) => field.kind === "richtext" && old?.props[name] !== node.props[name],
      );
    })
    .map((node) => node.props.id);
}

/** The id of the node whose rich-text editor has the focus in `frameDocument`, if any. */
export function focusedRichTextId(frameDocument: Document | null): string | null {
  const active = frameDocument?.activeElement;
  if (active?.closest(".ProseMirror") == null) {
    return null;
  }
  return active.closest("[data-puck-component]")?.getAttribute("data-puck-component") ?? null;
}
