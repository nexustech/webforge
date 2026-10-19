import type { Data, PuckAction } from "@puckeditor/core";
import type { EngineEdit, EngineEditKind, NodeDoc, PageDoc } from "../canvas-engine.js";
import type { ComponentLibrary } from "../library.js";
import { isTextField } from "./config.js";
import { findNode, nodeAt } from "./tree.js";

/** The part of Puck's app state the adapter reads. */
export type PuckState = {
  readonly data: Data;
  readonly ui: { readonly itemSelector: { index: number; zone?: string } | null };
};

/**
 * Puck's data as a {@link PageDoc}. Puck's `Data` is structurally the same tree (plus legacy
 * `zones`, which Webforge does not use); this only fills in the optional parts.
 */
export function toPageDoc(data: Partial<Data>): PageDoc {
  const { root, content } = data as {
    root?: { props?: Record<string, unknown> };
    content?: unknown;
  };
  // Keep Puck's objects where possible, so unchanged subtrees stay identical (cheap to compare).
  return {
    root: root?.props === undefined ? { ...root, props: {} } : (root as PageDoc["root"]),
    content: Array.isArray(content) ? (content as NodeDoc[]) : [],
  };
}

/** Id of the selected node in a Puck state. */
export function selectedNodeId(state: PuckState): string | null {
  const selector = state.ui.itemSelector;
  if (selector === null) {
    return null;
  }
  return nodeAt(toPageDoc(state.data), selector.zone, selector.index)?.props.id ?? null;
}

/** First prop whose value differs between two versions of a node. */
function changedField(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string | null {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (!Object.is(before[key], after[key])) {
      return key;
    }
  }
  return null;
}

/**
 * Translates a Puck action into a Webforge {@link EngineEdit}, or `null` if it didn't change the
 * page (selection, hover, zones registering). Actions Puck only dispatches internally (`set`,
 * `setData`) still produce a generic `page` edit when they change the page, so the document store
 * can never silently drift from the canvas (U8).
 */
export function editFromAction(
  action: PuckAction,
  next: PuckState,
  prev: PuckState,
  library: ComponentLibrary,
): EngineEdit | null {
  if (next.data === prev.data) {
    return null;
  }
  const page = toPageDoc(next.data);
  const before = toPageDoc(prev.data);
  const edit = (kind: EngineEditKind, node: NodeDoc | undefined, field: string | null = null) => ({
    kind,
    nodeId: node?.props.id ?? null,
    componentType: node?.type ?? null,
    field,
    page,
    selection: selectedNodeId(next),
  });

  switch (action.type) {
    case "insert":
      return edit("insert", nodeAt(page, action.destinationZone, action.destinationIndex));
    case "move":
    case "reorder":
      return edit("move", nodeAt(page, action.destinationZone, action.destinationIndex));
    case "duplicate":
      return edit("duplicate", nodeAt(page, action.sourceZone, action.sourceIndex + 1));
    case "remove":
      return edit("remove", nodeAt(before, action.zone, action.index));
    case "replace": {
      const id = action.data.props.id;
      const node = findNode(page, id);
      const field = changedField(findNode(before, id)?.props ?? {}, node?.props ?? {});
      const isText = node !== undefined && field !== null && isTextField(library, node.type, field);
      return edit(isText ? "text" : "props", node, field);
    }
    case "replaceRoot":
      return edit("root", undefined, changedField(before.root.props, page.root.props));
    default:
      return edit("page", undefined);
  }
}
