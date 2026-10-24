import type { AppState, PuckAction } from "@puckeditor/core";
import {
  type NodeDoc,
  type PageDoc,
  pageAnchors,
  pastedCopies,
  type SharedCopyNode,
} from "@webforge/model";
import type { EngineEdit } from "../canvas-engine.js";
import { copyIndex, type DragKeys, type Drop, insertedAt, takeDragKeys } from "./drag-copies.js";
import { toPageDoc } from "./edit-from-action.js";
import type { CanvasDocs } from "./route-edit.js";
import { copiesOn, copyShownBy } from "./shared-copies.js";
import { isShared, isSharedRegion } from "./shared-layout.js";
import { findNode, nodeAt } from "./tree.js";

/**
 * The drop a drag with Ctrl or Cmd held asked to be a copy instead of a move (1.30), if `action`
 * is one, and whether Shift asked for a linked copy: only a drop while Puck is dragging (`prev`),
 * never a move from the keyboard, which holds Ctrl too. Every drop takes the keys held for it.
 */
export function copyDrop(
  action: PuckAction,
  prev: AppState,
  keys: DragKeys,
): { readonly drop: Drop; readonly linked: boolean } | null {
  if (prev.ui.isDragging !== true) return null;
  if (action.type !== "move" && action.type !== "reorder" && action.type !== "insert") {
    return null;
  }
  const held = takeDragKeys(keys);
  if (!held.copy || action.type === "insert") return null;
  const drop = action.type === "move" ? action : { ...action, sourceZone: action.destinationZone };
  return { drop, linked: held.linked };
}

/** What a copy drop does ({@link planCopyDrop}). */
export type CopyDropPlan =
  /** Nothing: Puck's view is put back as it was. */
  | { readonly kind: "refuse" }
  /** Another linked copy of `copy`'s shared section, placed where it dropped. */
  | { readonly kind: "linked"; readonly copy: NodeDoc & SharedCopyNode }
  /** A copy of what was dragged where it dropped: the page `after`, recorded as `edit`. */
  | { readonly kind: "copy"; readonly after: PageDoc; readonly edit: EngineEdit };

/**
 * What a drag with Ctrl or Cmd held does (1.30, UX-4): what was dragged stays, and a copy goes
 * where it dropped (`drop`), as one step ("Duplicated Heading"), its ids and anchors its own as a
 * pasted one's are. With Shift too (`linked`), a linked copy of a shared section places another
 * linked copy there (F-ED-23); without, the copy is of its section, the page's own. An element
 * inside a linked copy is copied within the shared section, as Duplicate does there; with Shift,
 * nothing happens. The Header and Footer themselves stay where they are, once each (F-ED-7).
 * `prev` is Puck's state before the drop.
 */
export function planCopyDrop(
  drop: Drop,
  linked: boolean,
  prev: AppState,
  docs: CanvasDocs,
): CopyDropPlan {
  const { page, layout, shared } = docs;
  const before = toPageDoc(prev.data);
  const node = nodeAt(before, drop.sourceZone, drop.sourceIndex);
  if (node === undefined || isSharedRegion(layout, node.props.id)) {
    return { kind: "refuse" };
  }
  const copy = linked ? copyShownBy(node, copiesOn(page.content), shared) : undefined;
  if (copy !== undefined) {
    return { kind: "linked", copy };
  }
  // Shift asks for a linked copy, which only a whole copy makes. An element inside one is neither
  // the page's own nor the Header's or Footer's: copying it there instead would change every copy
  // of the section, so nothing happens (#255 review).
  const ownOrShared =
    findNode(page, node.props.id) !== undefined || isShared(layout, node.props.id);
  if (linked && !ownOrShared) {
    return { kind: "refuse" };
  }
  const [clone] = pastedCopies([node], pageAnchors(page.content, shared, layout));
  if (clone === undefined) {
    return { kind: "refuse" };
  }
  const after = insertedAt(before, drop.destinationZone, copyIndex(drop), clone);
  const id = clone.props.id;
  return {
    kind: "copy",
    after,
    edit: {
      kind: "duplicate",
      nodeId: id,
      componentType: clone.type,
      field: null,
      page: after,
      selection: id,
    },
  };
}
