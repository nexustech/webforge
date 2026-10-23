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

/** The focused rich-text editor in `frameDocument`: Tiptap keeps it on its element. */
function focusedEditor(frameDocument: Document | null): { getHTML(): string } | null {
  const element = frameDocument?.activeElement?.closest(".ProseMirror") as {
    readonly editor?: { getHTML?: unknown };
  } | null;
  const editor = element?.editor;
  return typeof editor?.getHTML === "function" ? (editor as { getHTML(): string }) : null;
}

/**
 * Whether what the focused rich-text editor in `frameDocument` shows has all reached `page` (#146):
 * its text is its element's value there. True when no rich text has the focus.
 */
export function richTextArrived(frameDocument: Document | null, page: PageDoc): boolean {
  const editor = focusedEditor(frameDocument);
  const id = focusedRichTextId(frameDocument);
  if (editor === null || id === null) {
    return true;
  }
  const html = editor.getHTML();
  const node = allNodes(page).find((each) => each.props.id === id);
  return node !== undefined && Object.values(node.props).includes(html);
}

/** The id of the node whose rich-text editor has the focus in `frameDocument`, if any. */
export function focusedRichTextId(frameDocument: Document | null): string | null {
  const active = frameDocument?.activeElement;
  if (active?.closest(".ProseMirror") == null) {
    return null;
  }
  return active.closest("[data-puck-component]")?.getAttribute("data-puck-component") ?? null;
}
