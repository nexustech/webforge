import { t } from "@webforge/i18n";
import {
  anchorsIn,
  MAX_COPIED_NODES,
  type MediaMeta,
  type NodeDoc,
  pastedCopies,
} from "@webforge/model";
import { mediaUsedBy } from "@webforge/site-components";
import type {
  ClipboardApi,
  ClipboardReadResult,
  ClipboardWriteResult,
} from "../../shared/ipc/clipboard.js";
import { type AddTarget, addTarget } from "../add/add-items.js";
import { currentPage, type EditorSession } from "../editor/editor-session.js";
import { findNode } from "../editor/nodes.js";
import { putInMedia } from "../media/media-commands.js";

/**
 * Copy, Cut and Paste of sections and elements (1.25, F-ED-16): within a page, between pages and
 * into another site opened later. The elements travel through the system clipboard with the Media
 * items they show; each paste or cut is one undo step.
 */

/** The parts of an editor session copying and pasting use. */
export type ClipboardSession = Pick<EditorSession, "history" | "ui" | "edit" | "library">;

/** How undo labels and messages name an element: its Layers name, else its component's name. */
function itemName(session: ClipboardSession, node: NodeDoc): string {
  const layerName = node.props.layerName?.trim();
  return layerName === undefined || layerName === ""
    ? (session.library.components[node.type]?.label ?? node.type)
    : t("history.namedItem", { name: layerName });
}

/** The selected element of the shown page, if one is selected there. */
function selectedNode(session: ClipboardSession): NodeDoc | undefined {
  const { nodeId } = session.ui.getState();
  const content = currentPage(session)?.doc.content;
  return nodeId === null || content === undefined
    ? undefined
    : findNode(content, (node) => node.props.id === nodeId);
}

/** The Media items `nodes` show, as the site has them. */
function mediaOf(session: ClipboardSession, nodes: readonly NodeDoc[]): MediaMeta[] {
  const { media } = session.history.document.getState();
  return [...mediaUsedBy(nodes, session.library)].flatMap((id) => {
    const item = Object.hasOwn(media, id) ? media[id as keyof typeof media] : undefined;
    return item === undefined ? [] : [item];
  });
}

/** Removes the node `id` from `nodes` or their slots; whether it was there. */
function removeNode(nodes: NodeDoc[], id: string): boolean {
  const index = nodes.findIndex((node) => node.props.id === id);
  if (index !== -1) {
    nodes.splice(index, 1);
    return true;
  }
  return nodes.some((node) =>
    Object.values(node.props).some(
      (value) => Array.isArray(value) && removeNode(value as NodeDoc[], id),
    ),
  );
}

/**
 * Copies the selected element, with everything in it, to the clipboard. With `cut`, also removes
 * it from the page as one step ("Cut Heading"), once the copy is on the clipboard. Returns whether
 * it copied.
 */
export async function copySelected(
  session: ClipboardSession,
  clipboard: Pick<ClipboardApi, "write">,
  notify: (message: string) => void,
  cut = false,
): Promise<boolean> {
  const node = selectedNode(session);
  if (node === undefined) {
    return false;
  }
  let result: ClipboardWriteResult;
  try {
    result = await clipboard.write({ nodes: [node], media: mediaOf(session, [node]) });
  } catch {
    result = { status: "failed", reason: "unknown" };
  }
  if (result.status !== "copied") {
    notify(t("site.clipboard.copyFailed"));
    return false;
  }
  if (cut) {
    const ui = session.ui.getState();
    const id = node.props.id;
    session.edit(
      "remove",
      t("site.clipboard.history.cut", { item: itemName(session, node) }),
      (draft) => {
        const content = draft.pages[ui.pageId]?.doc.content;
        if (content !== undefined) removeNode(content, id);
      },
      { selectionAfter: { ...ui, nodeId: null } },
    );
    session.ui.setState({ nodeId: null });
  }
  return true;
}

/** Inserts `nodes` at `target` in a page's top-level `content`. */
function insertAt(content: NodeDoc[], target: AddTarget, nodes: readonly NodeDoc[]): void {
  if (target.parentId === null || target.slot === null) {
    content.splice(target.index, 0, ...nodes);
    return;
  }
  const { parentId, slot } = target;
  const parent = findNode(content, (candidate) => candidate.props.id === parentId);
  if (parent === undefined) return;
  const list = parent.props[slot];
  if (Array.isArray(list)) {
    list.splice(target.index, 0, ...nodes);
  } else {
    parent.props[slot] = [...nodes];
  }
}

/**
 * Where pasted `nodes` go on a page with top-level `content`: where the Add panel would add the
 * first one (1.13), if that place takes them all. `undefined` when no place on the page does, such
 * as for an FAQ question with no FAQ on the page, or a Header (never part of a page).
 */
export function pasteTarget(
  library: ClipboardSession["library"],
  content: readonly NodeDoc[],
  nodes: readonly NodeDoc[],
  selectedId: string | null,
): AddTarget | undefined {
  const [first, ...rest] = nodes;
  if (first === undefined) return undefined;
  const target = addTarget(library, content, first.type, selectedId);
  if (target === undefined) return undefined;
  const sameTarget = (node: NodeDoc) => {
    const other = addTarget(library, content, node.type, selectedId);
    return (
      other?.parentId === target.parentId &&
      other.slot === target.slot &&
      other.index === target.index
    );
  };
  return rest.every(sameTarget) ? target : undefined;
}

/** What the user is told when the clipboard has nothing to paste or couldn't be read. */
function readMessage(result: Exclude<ClipboardReadResult, { status: "elements" }>): string {
  if (result.status === "empty") return t("site.clipboard.nothing");
  return result.reason === "read-only"
    ? t("site.clipboard.readOnly")
    : t("site.clipboard.pasteFailed");
}

/**
 * Pastes the elements on the clipboard into the shown page, where {@link pasteTarget} puts them,
 * as one step ("Pasted Heading") that selects the first. Their images join the site's Media in the
 * same step, keeping their ids. Returns whether it pasted.
 */
export async function pasteElements(
  session: ClipboardSession,
  clipboard: Pick<ClipboardApi, "read">,
  notify: (message: string) => void,
): Promise<boolean> {
  let result: ClipboardReadResult;
  try {
    result = await clipboard.read();
  } catch {
    result = { status: "failed", reason: "unknown" };
  }
  if (result.status !== "elements") {
    notify(readMessage(result));
    return false;
  }
  const { nodes, media } = result.elements;
  const [first] = nodes;
  const page = currentPage(session);
  const ui = session.ui.getState();
  if (first === undefined || page === undefined || nodes.length > MAX_COPIED_NODES) {
    return false;
  }
  const target = pasteTarget(session.library, page.doc.content, nodes, ui.nodeId);
  if (target === undefined) {
    notify(t("site.clipboard.cantPaste", { item: itemName(session, first) }));
    return false;
  }
  const copies = pastedCopies(nodes, anchorsIn(page.doc.content));
  const firstId = copies[0]?.props.id ?? null;
  const label =
    copies.length === 1
      ? t("site.clipboard.history.pasted", { item: itemName(session, first) })
      : t("site.clipboard.history.pastedMany", { count: copies.length });
  session.edit(
    "insert",
    label,
    (draft) => {
      const content = draft.pages[ui.pageId]?.doc.content;
      if (content === undefined) return;
      // An image this site already has stays as it is; the others join its Media.
      putInMedia(
        draft,
        media.filter((item) => !Object.hasOwn(draft.media, item.id)),
      );
      insertAt(content, target, copies);
    },
    { selectionAfter: { ...ui, nodeId: firstId } },
  );
  session.ui.setState({ nodeId: firstId });
  return true;
}
