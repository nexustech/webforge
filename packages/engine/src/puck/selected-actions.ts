import type { PuckApi } from "@puckeditor/core";
import type { CanvasAction } from "../canvas-engine.js";
import { toPageDoc } from "./edit-from-action.js";
import { allNodes, ROOT_ZONE } from "./tree.js";

/**
 * Whether `action` can be done to the selected element now: something is selected, it isn't at the
 * end of its list, and Puck's permissions (locked in Content mode) allow it.
 */
export function canPerform(puck: PuckApi, action: CanvasAction): boolean {
  const selector = puck.appState.ui.itemSelector;
  const item = puck.selectedItem;
  if (action === "selectPrevious" || action === "selectNext") {
    return allNodes(toPageDoc(puck.appState.data)).length > 0;
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
export function performOnSelected(puck: PuckApi, action: CanvasAction): boolean {
  if (!canPerform(puck, action)) {
    return false;
  }
  const { dispatch } = puck;
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
