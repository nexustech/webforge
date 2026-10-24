import type { ComponentData, PuckApi } from "@puckeditor/core";
import type { CanvasAction } from "../canvas-engine.js";
import { toPageDoc } from "./edit-from-action.js";
import { componentSelector } from "./puck-dom.js";
import { startTextEditing } from "./text-editing.js";
import { allNodes, ROOT_ZONE } from "./tree.js";

/** Actions that only move the selection through the page's tree (F-ED-27). */
type TreeAction = Extract<
  CanvasAction,
  "selectParent" | "selectChild" | "selectPreviousSibling" | "selectNextSibling"
>;

/** Text actions, which the engine does on the canvas document (see `text-editing.ts`). */
type TextAction = Extract<CanvasAction, "editText" | "clearText">;

const isTreeAction = (action: CanvasAction): action is TreeAction =>
  action === "selectParent" ||
  action === "selectChild" ||
  action === "selectPreviousSibling" ||
  action === "selectNextSibling";

/** Whether `value` is an element in a slot (Puck's component data). */
const isComponent = (value: unknown): value is ComponentData =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { type?: unknown }).type === "string" &&
  typeof (value as { props?: { id?: unknown } }).props?.id === "string";

/**
 * Where `action` takes the selection from the selected element, or none: its parent (never the
 * page itself), its first element inside (in the first of its slots that has one), or its previous
 * or next element in its own list. Stays inside the page's tree, the shared Header and Footer
 * included, which the canvas shows with their banner when selected (F-ED-7).
 */
function treeTarget(puck: PuckApi, action: TreeAction): ReturnType<PuckApi["getSelectorForId"]> {
  const selector = puck.appState.ui.itemSelector;
  const item = puck.selectedItem;
  if (selector === null || item === null) return undefined;
  const id = item.props.id as string;
  switch (action) {
    case "selectParent": {
      // An element in one of the page's own lists (its sections) has only the page above it.
      if ((selector.zone ?? ROOT_ZONE).startsWith("root:")) return undefined;
      const parent = puck.getParentById(id);
      const parentId = parent?.props.id;
      return typeof parentId === "string" ? puck.getSelectorForId(parentId) : undefined;
    }
    case "selectChild": {
      for (const value of Object.values(item.props)) {
        const first = Array.isArray(value) ? value.find(isComponent) : undefined;
        if (first !== undefined) return puck.getSelectorForId(first.props.id as string);
      }
      return undefined;
    }
    case "selectPreviousSibling":
    case "selectNextSibling": {
      const zone = selector.zone ?? ROOT_ZONE;
      const index = selector.index + (action === "selectNextSibling" ? 1 : -1);
      return index >= 0 && puck.getItemBySelector({ zone, index }) !== undefined
        ? { zone, index }
        : undefined;
    }
  }
}

/**
 * Whether `action` can be done to the selected element now: something is selected, it isn't at the
 * end of its list, and Puck's permissions (locked in Content mode) allow it.
 */
export function canPerform(puck: PuckApi, action: Exclude<CanvasAction, TextAction>): boolean {
  const selector = puck.appState.ui.itemSelector;
  const item = puck.selectedItem;
  if (action === "selectPrevious" || action === "selectNext") {
    return allNodes(toPageDoc(puck.appState.data)).length > 0;
  }
  if (isTreeAction(action)) {
    return treeTarget(puck, action) !== undefined;
  }
  if (selector === null || item === null) {
    return false;
  }
  const permissions = puck.getPermissions({ item });
  const zone = selector.zone ?? ROOT_ZONE;
  switch (action) {
    case "moveUp":
      return permissions.drag === true && selector.index > 0;
    case "moveDown":
      return (
        permissions.drag === true &&
        puck.getItemBySelector({ zone, index: selector.index + 1 }) !== undefined
      );
    case "duplicate":
      return permissions.duplicate === true;
    case "delete":
      return permissions.delete === true;
  }
}

/**
 * Does `action` to Puck's selected element with Puck's own actions, so each edit reaches the
 * history through `onAction` as one step, just like the same action done with the mouse. Returns
 * false if {@link canPerform} says no.
 */
export function performOnSelected(
  puck: PuckApi,
  action: Exclude<CanvasAction, TextAction>,
): boolean {
  if (!canPerform(puck, action)) {
    return false;
  }
  const { dispatch } = puck;
  if (isTreeAction(action)) {
    const target = treeTarget(puck, action);
    if (target === undefined) return false;
    dispatch({ type: "setUi", ui: { itemSelector: target } });
    return true;
  }
  const selector = puck.appState.ui.itemSelector;
  if (action === "selectPrevious" || action === "selectNext") {
    const ids = allNodes(toPageDoc(puck.appState.data)).map((node) => node.props.id);
    const current = puck.selectedItem === null ? -1 : ids.indexOf(puck.selectedItem.props.id);
    // From no selection, down starts at the first element and up at the last.
    const next =
      current === -1
        ? action === "selectNext"
          ? 0
          : ids.length - 1
        : action === "selectNext"
          ? Math.min(current + 1, ids.length - 1)
          : Math.max(current - 1, 0);
    const id = ids[next];
    const target = id === undefined ? undefined : puck.getSelectorForId(id);
    if (target === undefined) {
      return false;
    }
    dispatch({ type: "setUi", ui: { itemSelector: target } });
    return true;
  }
  if (selector === null) {
    return false;
  }
  const zone = selector.zone ?? ROOT_ZONE;
  const { index } = selector;
  switch (action) {
    case "moveUp":
    case "moveDown": {
      const to = action === "moveUp" ? index - 1 : index + 1;
      dispatch({
        type: "move",
        sourceZone: zone,
        sourceIndex: index,
        destinationZone: zone,
        destinationIndex: to,
      });
      // Puck selects by position: keep the moved element selected.
      dispatch({ type: "setUi", ui: { itemSelector: { zone, index: to } } });
      return true;
    }
    case "duplicate":
      // Puck selects the copy.
      dispatch({ type: "duplicate", sourceZone: zone, sourceIndex: index });
      return true;
    case "delete":
      dispatch({ type: "remove", zone, index });
      dispatch({ type: "setUi", ui: { itemSelector: null } });
      return true;
  }
}

/**
 * Does `action` to the element selected in Puck (`puck`), on the canvas document `doc`: editing or
 * clearing its text on the canvas (F-ED-27), or one of Puck's own actions. Walking through a long
 * page from the keyboard keeps the selection in view. False if there was nothing to do.
 */
export function performOnCanvas(
  puck: PuckApi,
  doc: Document | undefined,
  action: CanvasAction,
): boolean {
  if (action === "editText" || action === "clearText") {
    const id = puck.selectedItem?.props.id;
    return (
      typeof id === "string" &&
      doc !== undefined &&
      startTextEditing(doc, id, action === "clearText")
    );
  }
  if (!performOnSelected(puck, action)) {
    return false;
  }
  if (action.startsWith("select")) {
    const id = puck.selectedItem?.props.id;
    const element = id === undefined ? null : doc?.querySelector(componentSelector(id));
    element?.scrollIntoView?.({ block: "nearest" });
  }
  return true;
}
