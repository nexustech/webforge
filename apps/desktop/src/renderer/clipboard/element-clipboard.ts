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
import type { MediaImportResult } from "../../shared/ipc-contract.js";
import { type AddTarget, addTarget, insertAt } from "../add/add-items.js";
import { currentPage, type EditorSession } from "../editor/editor-session.js";
import { findNode, removeNode } from "../editor/nodes.js";
import { type SharedRegion, sharedRegionOf, shownLayout } from "../editor/shared-layout.js";
import { layerItem } from "../layers/layers.js";
import { importMessages } from "../media/import-media.js";
import { addMedia, putInMedia } from "../media/media-commands.js";

/**
 * Copy, Cut and Paste of sections and elements (1.25, F-ED-16): within a page, between pages and
 * into another site opened later. The elements travel through the system clipboard with the Media
 * items they show; each paste or cut is one undo step.
 */

/** The parts of an editor session copying and pasting use. */
export type ClipboardSession = Pick<EditorSession, "history" | "ui" | "edit" | "library">;

/** How undo labels and messages name an element: its Layers name, else its component's name. */
function itemName(session: ClipboardSession, node: NodeDoc): string {
  const name = node.props.layerName?.trim();
  return layerItem({
    kind: session.library.components[node.type]?.label ?? node.type,
    name: name === "" ? undefined : name,
  });
}

/**
 * The selected element: on the shown page, or in the shared Header or Footer (`region`, F-ED-7),
 * which every page shows.
 */
function selectedNode(
  session: ClipboardSession,
): { readonly node: NodeDoc; readonly region?: SharedRegion } | undefined {
  const { nodeId } = session.ui.getState();
  if (nodeId === null) return undefined;
  const isSelected = (node: NodeDoc) => node.props.id === nodeId;
  const own = findNode(currentPage(session)?.doc.content ?? [], isSelected);
  if (own !== undefined) return { node: own };
  // The Header and Footer as this page shows them: never one its Page Settings hide.
  const site = session.history.document.getState();
  const layout = shownLayout(site, session.ui.getState().pageId);
  const region = sharedRegionOf(layout, nodeId);
  const node = region === undefined ? undefined : findNode(layout[region], isSelected);
  return node === undefined || region === undefined ? undefined : { node, region };
}

/** The Media items `nodes` show, as the site has them. */
function mediaOf(session: ClipboardSession, nodes: readonly NodeDoc[]): MediaMeta[] {
  const { media } = session.history.document.getState();
  return [...mediaUsedBy(nodes, session.library)].flatMap((id) => {
    const item = Object.hasOwn(media, id) ? media[id as keyof typeof media] : undefined;
    return item === undefined ? [] : [item];
  });
}

/**
 * Copies the selected element, with everything in it, to the clipboard. With `cut`, also removes
 * it as one step ("Cut Heading"), once the copy is on the clipboard: from the page, or from the
 * shared Header or Footer and so every page, after `confirmSharedCut` agrees (D7). The Header and
 * Footer themselves are never copied or cut. Returns whether it copied.
 */
export async function copySelected(
  session: ClipboardSession,
  clipboard: Pick<ClipboardApi, "write">,
  notify: (message: string) => void,
  cut = false,
  confirmSharedCut?: (item: string, region: SharedRegion) => Promise<boolean>,
): Promise<boolean> {
  const selected = selectedNode(session);
  if (selected === undefined) {
    return false;
  }
  const { node, region } = selected;
  // The shared Header and Footer themselves stay, like Duplicate and Delete leave them (F-ED-7);
  // the elements inside them can be copied and cut.
  const { layout } = session.history.document.getState();
  if (region !== undefined && layout[region].some((top) => top.props.id === node.props.id)) {
    notify(t("site.clipboard.sharedRegion", { item: itemName(session, node) }));
    return false;
  }
  // Cut from the shared Header or Footer changes every page showing it: asked before anything.
  if (cut && region !== undefined && confirmSharedCut !== undefined) {
    if (!(await confirmSharedCut(itemName(session, node), region))) return false;
  }
  // The page it is on: the user may have moved on by the time the copy is on the clipboard.
  const ui = session.ui.getState();
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
    const id = node.props.id;
    session.edit(
      "remove",
      t("site.clipboard.history.cut", {
        // "Cut shared Heading", as the other steps in the Header or Footer name it (F-ED-7).
        item:
          region === undefined
            ? itemName(session, node)
            : t("history.sharedItem", { item: itemName(session, node) }),
      }),
      (draft) => {
        // From the shared Header or Footer, it goes from every page.
        const list =
          region === undefined ? draft.pages[ui.pageId]?.doc.content : draft.layout[region];
        if (list !== undefined) removeNode(list, id);
      },
      { selectionAfter: { ...ui, nodeId: null } },
    );
    if (session.ui.getState().nodeId === id) session.ui.setState({ nodeId: null });
  }
  return true;
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
function readMessage(result: Extract<ClipboardReadResult, { status: "empty" | "failed" }>): string {
  if (result.status === "empty") return t("site.clipboard.nothing");
  return result.reason === "read-only"
    ? t("site.clipboard.readOnly")
    : t("site.clipboard.pasteFailed");
}

/**
 * Pastes what the clipboard holds. Elements go into the shown page, where {@link pasteTarget} puts
 * them, as one step ("Pasted Heading") that selects the first; their images join the site's Media in
 * the same step, keeping their ids. Image files or a copied image go to Media and the selection
 * ({@link pasteMedia}). Returns whether it pasted.
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
  if (result.status === "media") {
    return pasteMedia(session, result.items, result.rejected, notify);
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
  // Pasting goes into the page, never into the shared Header or Footer: elements don't move between
  // them and the page (F-ED-7). With a shared element selected, the page takes it as the Add panel
  // would with nothing selected. The Header and Footer as this page shows them, as when copying.
  const layout = shownLayout(session.history.document.getState(), ui.pageId);
  const selectedId =
    ui.nodeId === null || sharedRegionOf(layout, ui.nodeId) !== undefined ? null : ui.nodeId;
  const target = pasteTarget(session.library, page.doc.content, nodes, selectedId);
  if (target === undefined) {
    notify(t("site.clipboard.cantPaste", { item: itemName(session, first) }));
    return false;
  }
  // The shared Header and Footer show on the page too: their anchors are taken as well.
  const copies = pastedCopies(
    nodes,
    anchorsIn([...layout.header, ...page.doc.content, ...layout.footer]),
  );
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

/**
 * Pastes imported image files or a copied image (F-ED-16): one image goes into the selected
 * element's image field, if it has one ("Pasted image 'shop.png'"), and joins Media in the same
 * step; in the shared Header or Footer, every page shows it ("… into shared Header"). Anything
 * else is added to Media ("Added image 'shop.png'"), which a message says. Inserting a new element
 * for it comes with Phase 2's Image element. Files Media didn't take are named in a message, as
 * for a drop.
 */
function pasteMedia(
  session: ClipboardSession,
  items: readonly MediaMeta[],
  rejected: Extract<MediaImportResult, { status: "imported" }>["rejected"],
  notify: (message: string) => void,
): boolean {
  for (const message of importMessages({ status: "imported", items: [], rejected })) {
    notify(message);
  }
  const [item] = items;
  if (item === undefined) {
    return false;
  }
  const selected = selectedNode(session);
  const field =
    selected === undefined || items.length > 1 || item.kind !== "image"
      ? undefined
      : Object.entries(session.library.components[selected.node.type]?.fields ?? {}).find(
          ([, def]) => def.kind === "media",
        )?.[0];
  if (selected === undefined || field === undefined) {
    addMedia(session, items);
    notify(
      items.length === 1
        ? t("site.clipboard.addedToMedia", {
            name: t("history.namedItem", { name: item.fileName }),
          })
        : t("site.clipboard.addedManyToMedia", { count: items.length }),
    );
    return true;
  }
  const { node, region } = selected;
  const ui = session.ui.getState();
  const id = node.props.id;
  session.edit(
    "props",
    region === undefined
      ? t("site.clipboard.history.pastedImage", {
          name: t("history.namedItem", { name: item.fileName }),
        })
      : t("site.clipboard.history.pastedSharedImage", {
          name: t("history.namedItem", { name: item.fileName }),
          item: t("history.sharedItem", { item: itemName(session, node) }),
        }),
    (draft) => {
      putInMedia(draft, [item]);
      const list =
        region === undefined ? draft.pages[ui.pageId]?.doc.content : draft.layout[region];
      const target = list === undefined ? undefined : findNode(list, (n) => n.props.id === id);
      if (target !== undefined) target.props[field] = { mediaId: item.id };
    },
    { selectionAfter: ui },
  );
  return true;
}
