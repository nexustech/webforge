import { t } from "@webforge/i18n";
import {
  copiedNodeId,
  isNodeDoc,
  isSharedCopy,
  type NodeDoc,
  type PageDoc,
  type SharedCopyNode,
  type SharedSectionsDoc,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import { findNode } from "../editor/nodes.js";

/**
 * Layers (F-ED-12, Advanced): the shown page's sections and elements as a tree, and the changes the
 * Layers panel makes to them, each one labelled undo step that keeps the element selected. A linked
 * copy of a shared section is one layer, under the id the canvas shows its section by, so selecting
 * either selects the other; its name and hidden state are the copy's own (F-ED-23).
 */

/** One row of the Layers tree. */
export type Layer = {
  readonly id: string;
  /** The component's display name ("Heading"). */
  readonly kind: string;
  /** The name the person gave it in Layers, if any. */
  readonly name: string | undefined;
  readonly hidden: boolean;
  readonly children: readonly Layer[];
  /** Set for a linked copy: the name of the shared section it shows (F-ED-23). */
  readonly sharedSection?: string;
  /**
   * It can't be moved or deleted, only edited (UX-12), as the shared Header and Footer themselves
   * are. Nothing the page lists is locked yet; Layers marks it when something is.
   */
  readonly locked?: boolean;
  /** It has an animation (UX-12), which 2.12 adds; Layers marks it. */
  readonly animated?: boolean;
};

/** The longest layer name the model accepts. */
const MAX_NAME_LENGTH = 100;

/** The node lists inside `node`: its slots' contents, in field order. */
function slotsOf(node: NodeDoc, library: ComponentLibrary): NodeDoc[][] {
  const fields = library.components[node.type]?.fields ?? {};
  return Object.entries(fields)
    .filter(([, field]) => field.kind === "slot")
    .map(([name]) => {
      const value = node.props[name];
      return Array.isArray(value) ? value.filter(isNodeDoc) : [];
    });
}

/** The shared section a linked copy shows, if the site has it. */
function sectionOf(shared: SharedSectionsDoc, copy: NodeDoc & SharedCopyNode) {
  const id = copy.props.sharedSectionId;
  return Object.hasOwn(shared, id) ? shared[id] : undefined;
}

/**
 * The Layers tree of `nodes`: each node with the nodes in its slots as children. A linked copy is
 * one layer, named after its shared section unless it has a name of its own; its section's elements
 * are edited on the canvas. A copy of a shared section the site doesn't have shows nothing.
 */
export function layersOf(
  nodes: readonly NodeDoc[],
  library: ComponentLibrary,
  shared: SharedSectionsDoc = {},
): Layer[] {
  return nodes.flatMap((node): Layer[] => {
    const name = node.props.layerName?.trim() || undefined;
    if (isSharedCopy(node)) {
      const entry = sectionOf(shared, node);
      if (entry === undefined) return [];
      const { section } = entry;
      return [
        {
          id: copiedNodeId(node.props.id, section.props.id),
          kind: library.components[section.type]?.label ?? section.type,
          name: name ?? entry.name,
          hidden: node.props.hidden === true,
          children: [],
          sharedSection: entry.name,
        },
      ];
    }
    return [
      {
        id: node.props.id,
        kind: library.components[node.type]?.label ?? node.type,
        name,
        hidden: node.props.hidden === true,
        children: slotsOf(node, library).flatMap((list) => layersOf(list, library, shared)),
      },
    ];
  });
}

/** How undo labels name a layer: its own name in quotes, else its component ("Heading"). */
export const layerItem = (layer: Pick<Layer, "kind" | "name">) =>
  layer.name === undefined ? layer.kind : t("history.namedItem", { name: layer.name });

/** The node list holding the node `id`, and its index there, searching slots too. */
export function placeOf(
  nodes: NodeDoc[],
  id: string,
  library: ComponentLibrary,
): { list: NodeDoc[]; index: number } | undefined {
  const index = nodes.findIndex((node) => node.props.id === id);
  if (index !== -1) {
    return { list: nodes, index };
  }
  for (const node of nodes) {
    const fields = library.components[node.type]?.fields ?? {};
    for (const [field, def] of Object.entries(fields)) {
      const value = node.props[field];
      if (def.kind === "slot" && Array.isArray(value)) {
        const found = placeOf(value as NodeDoc[], id, library);
        if (found !== undefined) return found;
      }
    }
  }
  return undefined;
}

/** The parts of an editor session the Layers panel uses. */
export type LayersSession = Pick<EditorSession, "history" | "ui" | "edit" | "library">;

/** The page's own node for layer `id`: a linked copy for the id the canvas shows its section by. */
export function ownId(content: readonly NodeDoc[], shared: SharedSectionsDoc, id: string): string {
  const copy = content.filter(isSharedCopy).find((node) => {
    const section = sectionOf(shared, node)?.section;
    return section !== undefined && copiedNodeId(node.props.id, section.props.id) === id;
  });
  return copy?.props.id ?? id;
}

/** The shown page and the layer `id` on it, before a change, with the page's own node for it. */
function target(session: LayersSession, id: string) {
  const { pageId } = session.ui.getState();
  const site = session.history.document.getState();
  const page: PageDoc | undefined = site.pages[pageId]?.doc;
  const own = page === undefined ? id : ownId(page.content, site.sharedSections, id);
  const node = page === undefined ? undefined : findNode(page.content, (n) => n.props.id === own);
  if (node === undefined) {
    return undefined;
  }
  const [layer] = layersOf([node], session.library, site.sharedSections);
  return layer === undefined ? undefined : { pageId, layer, own };
}

/**
 * Runs `change` on the page's own node `own` for layer `id` (which a step that selects selects) on
 * the shown page, as one undo step.
 */
function editNode(
  session: LayersSession,
  { id, own }: { readonly id: string; readonly own: string },
  kind: "props" | "move",
  /** Whether the step selects the layer (a move does; a hide or rename leaves the selection). */
  select: boolean,
  label: string,
  change: (node: NodeDoc, place: { list: NodeDoc[]; index: number }) => void,
): void {
  const current = session.ui.getState();
  const { pageId } = current;
  // A step that selects selects the layer alone: keeping the others could list it twice (#262).
  const selectionAfter = select ? { ...current, nodeId: id, others: [] } : current;
  session.edit(
    kind,
    label,
    (draft) => {
      const content = draft.pages[pageId]?.doc.content;
      const place = content === undefined ? undefined : placeOf(content, own, session.library);
      const node = place?.list[place.index];
      if (place !== undefined && node !== undefined) {
        change(node, place);
      }
    },
    { selectionAfter },
  );
  session.ui.setState(selectionAfter, true);
}

/**
 * Names a layer (shown in Layers and undo labels: "Edited 'Opening times' text"). An empty name
 * removes it, so the component's name shows again.
 */
export function renameLayer(session: LayersSession, id: string, name: string): void {
  const found = target(session, id);
  const next = name.trim().slice(0, MAX_NAME_LENGTH).trim();
  if (found === undefined || next === (found.layer.name ?? "")) {
    return;
  }
  // A copy shows its shared section's name until it has one of its own: clearing it changes
  // nothing then.
  const named = found.layer.name === found.layer.sharedSection ? undefined : found.layer.name;
  if (named === undefined && next === "") {
    return;
  }
  const label =
    next === ""
      ? t("layers.history.unnamed", { item: layerItem(found.layer) })
      : t("layers.history.renamed", { item: found.layer.kind, name: next });
  editNode(session, { id, own: found.own }, "props", false, label, (node) => {
    if (next === "") {
      delete node.props.layerName;
    } else {
      node.props.layerName = next;
    }
  });
}

/** Hides a layer (dimmed on the canvas, left out of the export), or shows it again. */
export function setLayerHidden(session: LayersSession, id: string, hidden: boolean): void {
  const found = target(session, id);
  if (found === undefined || found.layer.hidden === hidden) {
    return;
  }
  const key = hidden ? "layers.history.hid" : "layers.history.showed";
  const at = { id, own: found.own };
  editNode(session, at, "props", false, t(key, { item: layerItem(found.layer) }), (node) => {
    if (hidden) {
      node.props.hidden = true;
    } else {
      delete node.props.hidden;
    }
  });
}

/** The layer `id` in `layers` or among their children. */
function findLayer(layers: readonly Layer[], id: string): Layer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    const inside = findLayer(layer.children, id);
    if (inside !== undefined) return inside;
  }
  return undefined;
}

/**
 * Element `id`'s layer on the shown page, if it is one: not an element of the shared Header or
 * Footer, nor one inside a linked copy (the copy is one layer).
 */
export function shownLayer(session: LayersSession, id: string): Layer | undefined {
  const site = session.history.document.getState();
  const content = site.pages[session.ui.getState().pageId]?.doc.content;
  return content === undefined
    ? undefined
    : findLayer(layersOf(content, session.library, site.sharedSections), id);
}

/** Hides a layer, or shows it again if it is hidden (F-ED-27: Mod + /, and the chip's *Hide*). */
export function toggleLayerHidden(session: LayersSession, id: string): void {
  const found = target(session, id);
  if (found !== undefined) setLayerHidden(session, id, !found.layer.hidden);
}

/**
 * Moves a layer to `index` among its siblings (by drag or Alt+arrow), as one step. An index past
 * either end, or the layer's own place, changes nothing.
 */
export function moveLayer(session: LayersSession, id: string, index: number): void {
  const found = target(session, id);
  const content =
    session.history.document.getState().pages[session.ui.getState().pageId]?.doc.content;
  const place =
    content === undefined || found === undefined
      ? undefined
      : placeOf(content, found.own, session.library);
  if (
    found === undefined ||
    place === undefined ||
    index < 0 ||
    index >= place.list.length ||
    index === place.index
  ) {
    return;
  }
  editNode(
    session,
    { id, own: found.own },
    "move",
    true,
    t("history.moved", { item: layerItem(found.layer) }),
    (node, at) => {
      at.list.splice(at.index, 1);
      at.list.splice(index, 0, node);
    },
  );
}
