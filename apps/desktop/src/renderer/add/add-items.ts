import type { InsertPoint } from "@webforge/engine";
import { isNodeDoc, type NodeDoc, newId } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { currentPage, type EditorSession } from "../editor/editor-session.js";
import { labelFor } from "../editor/labels.js";
import { findNode } from "../editor/nodes.js";

/**
 * The Add panel's catalogue (F-ED-1) and where a click adds to the page: sections between
 * sections, elements inside sections. The Header, Footer and child-only components such as an
 * FAQ's questions are never offered (ADR 0005).
 */

/** The Add panel's tabs. */
export type AddTab = "sections" | "elements";

/** A component the Add panel offers. */
export type AddItem = {
  /** Its component type ("Hero"). */
  readonly type: string;
  /** Its display name ("Hero"). */
  readonly label: string;
  /** Its group in the panel ("Heroes"); empty when it has none. */
  readonly category: string;
};

/** The components `tab` offers, in library order. */
export function addItems(library: ComponentLibrary, tab: AddTab): AddItem[] {
  const place = tab === "sections" ? "section" : "element";
  return Object.entries(library.components)
    .filter(([, def]) => (def.place ?? "element") === place)
    .map(([type, def]) => ({ type, label: def.label, category: def.category ?? "" }));
}

/**
 * `items` matching what the person typed (in the name or the group, ignoring case), grouped by
 * category in order of first appearance.
 */
export function groupItems(
  items: readonly AddItem[],
  query: string,
): { category: string; items: AddItem[] }[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const groups = new Map<string, AddItem[]>();
  for (const item of items) {
    const text = `${item.label} ${item.category}`.toLocaleLowerCase();
    if (words.every((word) => text.includes(word))) {
      groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    }
  }
  return [...groups].map(([category, grouped]) => ({ category, items: grouped }));
}

/** Where a new element goes: a list on the page, by its parent and slot, and a position in it. */
export type AddTarget = {
  /** The element whose slot it goes in, or `null` for the page's top level. */
  readonly parentId: string | null;
  /** That element's slot field; `null` at the top level. */
  readonly slot: string | null;
  readonly index: number;
};

/** Whether `type` may go in the slot `slot` of `parent`. */
function accepts(library: ComponentLibrary, parent: NodeDoc, slot: string, type: string): boolean {
  const field = library.components[parent.type]?.fields[slot];
  return field?.kind === "slot" && (field.allow === undefined || field.allow.includes(type));
}

/** The slot fields of `node` that take `type`, in field order. */
function slotsFor(library: ComponentLibrary, node: NodeDoc, type: string): string[] {
  return Object.keys(library.components[node.type]?.fields ?? {}).filter((slot) =>
    accepts(library, node, slot, type),
  );
}

/** The children of `node` in `slot`. */
const childrenOf = (node: NodeDoc, slot: string): NodeDoc[] => {
  const value = node.props[slot];
  return Array.isArray(value) ? value.filter(isNodeDoc) : [];
};

/** One step from the page's top level down to a node: the node, and where it sits. */
type Step = {
  readonly node: NodeDoc;
  readonly parent: NodeDoc | null;
  readonly slot: string | null;
};

/** The steps from the top level down to the node `id`, or `undefined` if it isn't on the page. */
function pathTo(
  nodes: readonly NodeDoc[],
  id: string,
  parent: NodeDoc | null = null,
  slot: string | null = null,
): Step[] | undefined {
  for (const node of nodes) {
    if (node.props.id === id) {
      return [{ node, parent, slot }];
    }
    for (const [name, value] of Object.entries(node.props)) {
      if (!Array.isArray(value)) continue;
      const below = pathTo(value.filter(isNodeDoc), id, node, name);
      if (below !== undefined) return [{ node, parent, slot }, ...below];
    }
  }
  return undefined;
}

/**
 * Where a click adds a component of `type` to a page with top-level `content`:
 * - a section goes at the + button's `point` if there is one, else after the section that holds
 *   the selection, else at the end of the page;
 * - an element goes into the selection if it takes it (at its end), else after the selection,
 *   else the same for the elements holding it, nearest first. Failing that, it goes at the end of
 *   the nearest section that takes it: before the selection's section first, then after; with
 *   nothing selected, the last one. `undefined` when nothing on the page takes it.
 */
export function addTarget(
  library: ComponentLibrary,
  content: readonly NodeDoc[],
  type: string,
  selectedId: string | null,
  point?: InsertPoint,
): AddTarget | undefined {
  const path = selectedId === null ? undefined : pathTo(content, selectedId);
  if ((library.components[type]?.place ?? "element") === "section") {
    if (point !== undefined) {
      return { parentId: null, slot: null, index: Math.min(point.index, content.length) };
    }
    const top = path?.[0]?.node;
    return {
      parentId: null,
      slot: null,
      index: top === undefined ? content.length : content.indexOf(top) + 1,
    };
  }
  for (const step of [...(path ?? [])].reverse()) {
    const [inside] = slotsFor(library, step.node, type);
    if (inside !== undefined) {
      return {
        parentId: step.node.props.id,
        slot: inside,
        index: childrenOf(step.node, inside).length,
      };
    }
    if (
      step.parent !== null &&
      step.slot !== null &&
      accepts(library, step.parent, step.slot, type)
    ) {
      return {
        parentId: step.parent.props.id,
        slot: step.slot,
        index: childrenOf(step.parent, step.slot).indexOf(step.node) + 1,
      };
    }
  }
  const top = path?.[0]?.node;
  const from = top === undefined ? content.length - 1 : content.indexOf(top);
  const nearest = [...content.slice(0, from + 1).reverse(), ...content.slice(from + 1)];
  for (const node of nearest) {
    const [inside] = slotsFor(library, node, type);
    if (inside !== undefined) {
      return { parentId: node.props.id, slot: inside, index: childrenOf(node, inside).length };
    }
  }
  return undefined;
}

/** The parts of an editor session adding uses. */
export type AddSession = Pick<EditorSession, "history" | "ui" | "edit" | "library">;

/** Where a click on `type` would add it on the shown page, if anywhere. */
export function addTargetFor(
  session: AddSession,
  type: string,
  point?: InsertPoint,
): AddTarget | undefined {
  const content = currentPage(session)?.doc.content ?? [];
  return addTarget(session.library, content, type, session.ui.getState().nodeId, point);
}

/**
 * Adds a new `type`, with its defaults, to the shown page where {@link addTarget} puts it, as one
 * "Added …" step that selects it. Returns whether it was added.
 */
export function addComponent(session: AddSession, type: string, point?: InsertPoint): boolean {
  const definition = session.library.components[type];
  const page = currentPage(session)?.doc;
  const target = addTargetFor(session, type, point);
  if (definition === undefined || page === undefined || target === undefined) {
    return false;
  }
  const { pageId, viewport } = session.ui.getState();
  const id = newId("node");
  const label = labelFor(
    { kind: "insert", nodeId: id, componentType: type, field: null, page, selection: id },
    session.library,
  );
  session.edit(
    "insert",
    label,
    (draft) => {
      const content = draft.pages[pageId]?.doc.content;
      if (content === undefined) return;
      const node: NodeDoc = { type, props: { ...structuredClone(definition.defaults), id } };
      if (target.parentId === null || target.slot === null) {
        content.splice(target.index, 0, node);
        return;
      }
      const parentId = target.parentId;
      const parent = findNode(content, (candidate) => candidate.props.id === parentId);
      if (parent === undefined) return;
      const list = parent.props[target.slot];
      if (Array.isArray(list)) {
        list.splice(target.index, 0, node);
      } else {
        parent.props[target.slot] = [node];
      }
    },
    { selectionAfter: { pageId, viewport, nodeId: id } },
  );
  session.ui.setState({ nodeId: id });
  return true;
}
