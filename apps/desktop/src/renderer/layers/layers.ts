import { t } from "@webforge/i18n";
import { isNodeDoc, type NodeDoc, type PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import { findNode } from "../editor/nodes.js";

/**
 * Layers (F-ED-12, Advanced): the shown page's sections and elements as a tree, and the changes the
 * Layers panel makes to them, each one labelled undo step that keeps the element selected.
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

/** The Layers tree of `nodes`: each node with the nodes in its slots as children. */
export function layersOf(nodes: readonly NodeDoc[], library: ComponentLibrary): Layer[] {
  return nodes.map((node) => {
    const name = node.props.layerName?.trim();
    return {
      id: node.props.id,
      kind: library.components[node.type]?.label ?? node.type,
      name: name === "" ? undefined : name,
      hidden: node.props.hidden === true,
      children: slotsOf(node, library).flatMap((list) => layersOf(list, library)),
    };
  });
}

/** How undo labels name a layer: its own name in quotes, else its component ("Heading"). */
export const layerItem = (layer: Pick<Layer, "kind" | "name">) =>
  layer.name === undefined ? layer.kind : t("history.namedItem", { name: layer.name });

/** The node list holding the node `id`, and its index there, searching slots too. */
function placeOf(
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

/** The shown page and the layer `id` on it, before a change. */
function target(session: LayersSession, id: string) {
  const { pageId } = session.ui.getState();
  const page: PageDoc | undefined = session.history.document.getState().pages[pageId]?.doc;
  const node = page === undefined ? undefined : findNode(page.content, (n) => n.props.id === id);
  if (node === undefined) {
    return undefined;
  }
  const [layer] = layersOf([node], session.library);
  return layer === undefined ? undefined : { pageId, layer };
}

/** Runs `change` on the node `id` of the shown page as one undo step. */
function editNode(
  session: LayersSession,
  id: string,
  kind: "props" | "move",
  /** Whether the step selects the layer (a move does; a hide or rename leaves the selection). */
  select: boolean,
  label: string,
  change: (node: NodeDoc, place: { list: NodeDoc[]; index: number }) => void,
): void {
  const current = session.ui.getState();
  const { pageId } = current;
  const selectionAfter = select ? { ...current, nodeId: id } : current;
  session.edit(
    kind,
    label,
    (draft) => {
      const content = draft.pages[pageId]?.doc.content;
      const place = content === undefined ? undefined : placeOf(content, id, session.library);
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
  const label =
    next === ""
      ? t("layers.history.unnamed", { item: layerItem(found.layer) })
      : t("layers.history.renamed", { item: found.layer.kind, name: next });
  editNode(session, id, "props", false, label, (node) => {
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
  editNode(session, id, "props", false, t(key, { item: layerItem(found.layer) }), (node) => {
    if (hidden) {
      node.props.hidden = true;
    } else {
      delete node.props.hidden;
    }
  });
}

/**
 * Moves a layer to `index` among its siblings (by drag or Alt+arrow), as one step. An index past
 * either end, or the layer's own place, changes nothing.
 */
export function moveLayer(session: LayersSession, id: string, index: number): void {
  const found = target(session, id);
  const content =
    session.history.document.getState().pages[session.ui.getState().pageId]?.doc.content;
  const place = content === undefined ? undefined : placeOf(content, id, session.library);
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
    id,
    "move",
    true,
    t("history.moved", { item: layerItem(found.layer) }),
    (node, at) => {
      at.list.splice(at.index, 1);
      at.list.splice(index, 0, node);
    },
  );
}
