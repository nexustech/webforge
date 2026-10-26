import { t } from "@webforge/i18n";
import {
  copiedNodeId,
  findNode,
  isNodeDoc,
  isSharedCopy,
  type NodeDoc,
  newSharedCopy,
  pageAnchors,
  pastedCopies,
} from "@webforge/model";
import { holdsOverfullSlot, overfillsSlots } from "@webforge/site-components";
import {
  type Layer,
  type LayersSession,
  layerItem,
  ownId,
  placeOf,
  shownLayer,
} from "../editor/layers.js";
import { selectedIds } from "../editor/selection.js";
import { shownLayout } from "../editor/shared-layout.js";

/**
 * Move, duplicate, delete and hide for several selected elements at once (1.31, UX-3): each one
 * undo step that names how many ("Deleted 3 elements"), which undo takes back with the whole
 * selection. They act on layers, the shown page's own elements, a linked copy as a whole; a
 * selection with anything else is refused, with the reason.
 */

/** What a bulk action did: nothing to tell, or why it did nothing. */
export type BulkResult = { readonly refused?: string };

/** A selected layer, with the page's own node for it. */
type Selected = { readonly id: string; readonly own: string; readonly layer: Layer };

/** Every node in `nodes` and in their slots, in the page's order. */
function inOrder(nodes: readonly NodeDoc[]): NodeDoc[] {
  return nodes.flatMap((node) => [
    node,
    ...Object.values(node.props).flatMap((value) =>
      Array.isArray(value) ? inOrder(value.filter(isNodeDoc)) : [],
    ),
  ]);
}

/**
 * The selected layers in the page's order, leaving out any inside another one selected (it goes,
 * or moves, with it); or why the selection can't be acted on as layers.
 */
function selectedLayers(
  session: LayersSession,
): readonly Selected[] | { readonly refused: string } {
  const site = session.history.document.getState();
  const { pageId } = session.ui.getState();
  const content = site.pages[pageId]?.doc.content ?? [];
  const selected = new Map<string, Selected>();
  for (const id of selectedIds(session.ui.getState())) {
    const layer = shownLayer(session, id);
    // The shared Header or Footer, or inside a linked copy: changed one at a time, where the
    // banner says how far a change reaches (F-ED-7, F-ED-23).
    if (layer === undefined) return { refused: t("bulk.shared") };
    const own = ownId(content, site.sharedSections, id);
    selected.set(own, { id, own, layer });
  }
  const nodes = inOrder(content);
  /** Whether `node` is inside another selected node. */
  const inside = (node: NodeDoc) =>
    nodes.some(
      (other) =>
        other !== node &&
        selected.has(other.props.id) &&
        findNode([other], (each) => each.props.id === node.props.id) !== undefined,
    );
  return nodes.flatMap((node) => {
    const found = selected.get(node.props.id);
    return found === undefined || inside(node) ? [] : [found];
  });
}

/** How a step names `layers`: by name for one, by count for several. */
const named = (layers: readonly Selected[], one: (item: string) => string, many: string) => {
  const [first] = layers;
  return layers.length === 1 && first !== undefined ? one(layerItem(first.layer)) : many;
};

/** Deletes every selected element as one step ("Deleted 3 elements"); nothing stays selected. */
export function deleteSelected(session: LayersSession): BulkResult {
  const layers = selectedLayers(session);
  if ("refused" in layers) return layers;
  const current = session.ui.getState();
  session.edit(
    "remove",
    named(
      layers,
      (item) => t("history.deleted", { item }),
      t("history.deletedMany", { count: layers.length }),
    ),
    (draft) => {
      const content = draft.pages[current.pageId]?.doc.content;
      if (content === undefined) return;
      for (const { own } of layers) {
        const place = placeOf(content, own, session.library);
        place?.list.splice(place.index, 1);
      }
    },
    { selectionAfter: { ...current, nodeId: null, others: [] }, apply: true },
  );
  return {};
}

/**
 * Duplicates every selected element as one step ("Duplicated 3 elements"), each copy just after its
 * original, with ids and anchors of its own; a linked copy places another linked copy (F-ED-23).
 * The copies are selected afterwards.
 */
export function duplicateSelected(session: LayersSession): BulkResult {
  const layers = selectedLayers(session);
  if ("refused" in layers) return layers;
  const site = session.history.document.getState();
  const current = session.ui.getState();
  const content = site.pages[current.pageId]?.doc.content ?? [];
  const layout = shownLayout(site, current.pageId);
  // Made before the step, so it can select them; each copy's anchors are free of the ones before.
  // Each copy with its original's own id, and the id the canvas shows it by.
  const copies: { readonly after: string; readonly copy: NodeDoc; readonly shown: string }[] = [];
  for (const { own } of layers) {
    const node = findNode(content, (each) => each.props.id === own);
    const soFar = [...content, ...copies.map((each) => each.copy)];
    if (node !== undefined && isSharedCopy(node)) {
      const id = node.props.sharedSectionId;
      const linked = newSharedCopy(soFar, id, site.sharedSections, layout);
      const root = site.sharedSections[id]?.section.props.id;
      const shown = root === undefined ? linked.props.id : copiedNodeId(linked.props.id, root);
      copies.push({ after: own, copy: linked, shown });
    } else if (node !== undefined) {
      const [copy] = pastedCopies([node], pageAnchors(soFar, site.sharedSections, layout));
      if (copy !== undefined) copies.push({ after: own, copy, shown: copy.props.id });
    }
  }
  // No more than a slot holds (a Columns' four): tried on a copy of the page first.
  const after = structuredClone(content) as NodeDoc[];
  for (const { after: original, copy } of copies) {
    const place = placeOf(after, original, session.library);
    place?.list.splice(place.index + 1, 0, copy);
  }
  if (overfillsSlots(session.library, content, after)) {
    const over = holdsOverfullSlot(
      session.library,
      copies.map(({ copy }) => copy),
    );
    return { refused: t(over ? "bulk.overfull" : "bulk.full") };
  }
  const shownIds = copies.map((each) => each.shown);
  const copiesSelected = { ...current, nodeId: shownIds[0] ?? null, others: shownIds.slice(1) };
  session.edit(
    "duplicate",
    named(
      layers,
      (item) => t("history.duplicated", { item }),
      t("history.duplicatedMany", { count: layers.length }),
    ),
    (draft) => {
      const page = draft.pages[current.pageId]?.doc.content;
      if (page === undefined) return;
      for (const { after, copy } of copies) {
        const place = placeOf(page, after, session.library);
        place?.list.splice(place.index + 1, 0, copy);
      }
    },
    { selectionAfter: copiesSelected, apply: true },
  );
  return {};
}

/**
 * Hides every selected element as one step ("Hid 3 elements"), or shows them all again if they are
 * all hidden already. The selection stays.
 */
export function toggleSelectedHidden(session: LayersSession): BulkResult {
  const layers = selectedLayers(session);
  if ("refused" in layers) return layers;
  const hide = layers.some(({ layer }) => !layer.hidden);
  const current = session.ui.getState();
  const label = hide
    ? named(
        layers,
        (item) => t("layers.history.hid", { item }),
        t("history.hidMany", { count: layers.length }),
      )
    : named(
        layers,
        (item) => t("layers.history.showed", { item }),
        t("history.showedMany", { count: layers.length }),
      );
  session.edit(
    "props",
    label,
    (draft) => {
      const content = draft.pages[current.pageId]?.doc.content;
      if (content === undefined) return;
      for (const { own } of layers) {
        const place = placeOf(content, own, session.library);
        const node = place?.list[place.index];
        if (node === undefined) continue;
        if (hide) node.props.hidden = true;
        else delete node.props.hidden;
      }
    },
    { selectionAfter: current },
  );
  return {};
}

/**
 * Moves every selected element one place up or down in its own list as one step ("Moved 3
 * elements"); side by side, they move together. If one is at that end of its list already,
 * nothing moves, and that is the reason. The selection stays.
 */
export function moveSelected(session: LayersSession, direction: "up" | "down"): BulkResult {
  const layers = selectedLayers(session);
  if ("refused" in layers) return layers;
  const site = session.history.document.getState();
  const current = session.ui.getState();
  const content = [...(site.pages[current.pageId]?.doc.content ?? [])];
  for (const { own, layer } of layers) {
    const place = placeOf(content, own, session.library);
    if (place === undefined) continue;
    if (direction === "up" ? place.index === 0 : place.index === place.list.length - 1) {
      const key = direction === "up" ? "bulk.first" : "bulk.last";
      return { refused: t(key, { item: layerItem(layer) }) };
    }
  }
  session.edit(
    "move",
    named(
      layers,
      (item) => t("history.moved", { item }),
      t("history.movedMany", { count: layers.length }),
    ),
    (draft) => {
      const page = draft.pages[current.pageId]?.doc.content;
      if (page === undefined) return;
      // Down: the last first, so each moves into the place the one after it has left.
      for (const { own } of direction === "up" ? layers : [...layers].reverse()) {
        const place = placeOf(page, own, session.library);
        const [node] = place === undefined ? [] : place.list.splice(place.index, 1);
        if (place !== undefined && node !== undefined) {
          place.list.splice(place.index + (direction === "up" ? -1 : 1), 0, node);
        }
      }
    },
    { selectionAfter: current },
  );
  return {};
}

/**
 * The elements like layer `id` on the shown page (*Select similar*, 1.35): every one of the page's
 * own elements of the same component, or, for a linked copy, every copy of the same shared
 * section, by the ids the canvas shows them by, `id` first and the rest in the page's order.
 * Undefined for an element that isn't a layer (the shared Header or Footer, or inside a copy).
 */
export function similarTo(session: LayersSession, id: string): string[] | undefined {
  if (shownLayer(session, id) === undefined) return undefined;
  const site = session.history.document.getState();
  const content = site.pages[session.ui.getState().pageId]?.doc.content ?? [];
  const own = ownId(content, site.sharedSections, id);
  const node = findNode(content, (each) => each.props.id === own);
  if (node === undefined) return undefined;
  const similar = isSharedCopy(node)
    ? content.flatMap((each) => {
        if (!isSharedCopy(each) || each.props.sharedSectionId !== node.props.sharedSectionId) {
          return [];
        }
        const root = site.sharedSections[each.props.sharedSectionId]?.section.props.id;
        return [root === undefined ? each.props.id : copiedNodeId(each.props.id, root)];
      })
    : inOrder(content).flatMap((each) =>
        each.type === node.type && !isSharedCopy(each) ? [each.props.id] : [],
      );
  return [id, ...similar.filter((each) => each !== id)];
}
