import type { Data, PuckAction } from "@puckeditor/core";
import type { NodeDoc, PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import type { EngineEdit, EngineEditKind, EnginePatch } from "../canvas-engine.js";
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

/** The props whose values differ between two versions of a node. */
function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !Object.is(before[key], after[key]));
}

function isPlainValue(value: unknown): value is EnginePatch["value"] {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * The patch for a `replace` that set one field to a plain value. Puck's `replace` changes only the
 * replaced node, so that field is the whole edit.
 */
function patchFor(node: NodeDoc, fields: readonly string[]): EnginePatch | null {
  const [field] = fields;
  if (fields.length !== 1 || field === undefined) {
    return null;
  }
  const value = node.props[field];
  return isPlainValue(value) ? { nodeId: node.props.id, field, value } : null;
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
  const edit = (
    kind: EngineEditKind,
    node: NodeDoc | undefined,
    field: string | null = null,
    patch: EnginePatch | null = null,
  ): EngineEdit => ({
    kind,
    nodeId: node?.props.id ?? null,
    componentType: node?.type ?? null,
    field,
    page,
    selection: selectedNodeId(next),
    ...(patch === null ? {} : { patch }),
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
      const old = findNode(before, id);
      const fields = changedFields(old?.props ?? {}, node?.props ?? {});
      const field = fields[0] ?? null;
      const isText = node !== undefined && field !== null && isTextField(library, node.type, field);
      const patch = node === undefined || old === undefined ? null : patchFor(node, fields);
      return edit(isText ? "text" : "props", node, field, patch);
    }
    case "replaceRoot":
      return edit("root", undefined, changedFields(before.root.props, page.root.props)[0] ?? null);
    default:
      return edit("page", undefined);
  }
}
