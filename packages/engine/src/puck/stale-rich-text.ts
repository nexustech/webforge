import type { NodeDoc, PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { COMPONENT, COMPONENT_ATTRIBUTE, RICH_TEXT } from "./puck-dom.js";
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
  const element = frameDocument?.activeElement?.closest(RICH_TEXT) as {
    readonly editor?: { getHTML?: unknown };
  } | null;
  const editor = element?.editor;
  return typeof editor?.getHTML === "function" ? (editor as { getHTML(): string }) : null;
}

/** Rich text as compared: an emptied editor's `<p></p>` is no text, as the page may store it. */
const comparable = (value: unknown) =>
  typeof value === "string" ? (value === "<p></p>" ? "" : value) : value;

/**
 * Whether what the focused rich-text editor in `frameDocument` shows has all reached `page` (#146):
 * its text is the value of its field (`field`, Puck's name for the focused one) there, or, if that
 * isn't one of the element's own props, of any of them. True when no rich text has the focus.
 */
export function richTextArrived(
  frameDocument: Document | null,
  page: PageDoc,
  field: string | null | undefined,
): boolean {
  const editor = focusedEditor(frameDocument);
  const id = focusedRichTextId(frameDocument);
  if (editor === null || id === null) {
    return true;
  }
  const html = comparable(editor.getHTML());
  const node = allNodes(page).find((each) => each.props.id === id);
  if (node === undefined) {
    return false;
  }
  const values =
    typeof field === "string" && Object.hasOwn(node.props, field)
      ? [node.props[field]]
      : Object.values(node.props);
  return values.some((value) => comparable(value) === html);
}

/** The id of the node whose rich-text editor has the focus in `frameDocument`, if any. */
export function focusedRichTextId(frameDocument: Document | null): string | null {
  const active = frameDocument?.activeElement;
  if (active?.closest(RICH_TEXT) == null) {
    return null;
  }
  return active.closest(COMPONENT)?.getAttribute(COMPONENT_ATTRIBUTE) ?? null;
}
