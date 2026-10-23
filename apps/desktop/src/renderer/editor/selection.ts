import { createStore, type StoreApi } from "zustand/vanilla";
import type { EditorSelection } from "./editor-session.js";

/** No other selected elements: one, or none. */
const NONE: readonly string[] = [];

/**
 * The editor's UI store (U6). Several elements can be selected (1.31, UX-3): `nodeId` is the one
 * the canvas and the Edit panel show, `others` the rest. Selecting an element or a page alone (a
 * plain click, an arrow key, a page switch) ends a multi-selection, so only what sets `others` too
 * keeps one going; undo restores a selection whole.
 */
export function createSelectionStore(initial: EditorSelection): StoreApi<EditorSelection> {
  const store = createStore<EditorSelection>()(() => initial);
  const setState = (
    partial:
      | EditorSelection
      | Partial<EditorSelection>
      | ((state: EditorSelection) => EditorSelection | Partial<EditorSelection>),
    replace?: boolean,
  ) => {
    if (replace === true) {
      store.setState(partial as EditorSelection, true);
      return;
    }
    store.setState((state) => {
      const next = typeof partial === "function" ? partial(state) : partial;
      const selectsAlone = ("nodeId" in next || "pageId" in next) && !("others" in next);
      return selectsAlone && (state.others ?? NONE).length > 0 ? { ...next, others: NONE } : next;
    });
  };
  return { ...store, setState: setState as StoreApi<EditorSelection>["setState"] };
}

/** Every selected element, the one the canvas shows first. */
export function selectedIds(selection: Pick<EditorSelection, "nodeId" | "others">): string[] {
  return selection.nodeId === null ? [] : [selection.nodeId, ...(selection.others ?? NONE)];
}

/**
 * Selects the elements `ids` (by the ids the canvas shows them by), the first the one the canvas
 * and the Edit panel show; none for an empty list. For whatever selects several at once, such as
 * *Select similar* (1.35).
 */
export function selectElements(ui: StoreApi<EditorSelection>, ids: readonly string[]): void {
  const unique = [...new Set(ids)];
  ui.setState({ nodeId: unique[0] ?? null, others: unique.slice(1) });
}

/**
 * Adds element `id` to the selection, the one shown now, or takes it out if it is in it already
 * (Ctrl/Cmd- or Shift-click, 1.31).
 */
export function toggleSelected(ui: StoreApi<EditorSelection>, id: string): void {
  const selected = selectedIds(ui.getState());
  selectElements(
    ui,
    selected.includes(id) ? selected.filter((each) => each !== id) : [id, ...selected],
  );
}
