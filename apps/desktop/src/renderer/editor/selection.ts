import type { Viewport } from "@webforge/engine";
import type { PageId } from "@webforge/model";
import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * What undo shows again (U3): the page, the selected elements and the device view. It is also the
 * UI state (U6): changing it is never an undo step.
 */
export type EditorSelection = {
  readonly pageId: PageId;
  /** The selected element the canvas and the Edit panel show, if any. */
  readonly nodeId: string | null;
  /** The other selected elements, while several are (1.31); none when left out. */
  readonly others?: readonly string[];
  readonly viewport: Viewport;
};

/** No other selected elements: one, or none. */
const NONE: readonly string[] = [];

/**
 * The editor's UI store (U6). Several elements can be selected (1.31, UX-3): `nodeId` is the one
 * the canvas and the Edit panel show, `others` the rest. Selecting an element or a page alone (a
 * plain click, an arrow key, a page switch) ends a multi-selection, so only what sets `others` too
 * keeps one going; undo restores a selection whole.
 */
export function createSelectionStore(initial: EditorSelection): StoreApi<EditorSelection> {
  const store = createStore<EditorSelection>()(() => tidy(initial));
  const setState = (
    partial:
      | EditorSelection
      | Partial<EditorSelection>
      | ((state: EditorSelection) => EditorSelection | Partial<EditorSelection>),
    replace?: boolean,
  ) => {
    if (replace === true) {
      store.setState(tidy(partial as EditorSelection), true);
      return;
    }
    store.setState((state) => {
      const next = typeof partial === "function" ? partial(state) : partial;
      const selectsAlone = ("nodeId" in next || "pageId" in next) && !("others" in next);
      const ends = selectsAlone && (state.others ?? NONE).length > 0;
      return tidy({ ...state, ...next, ...(ends ? { others: NONE } : {}) });
    }, true);
  };
  return { ...store, setState: setState as StoreApi<EditorSelection>["setState"] };
}

/**
 * `state` with each selected element once: none of the others is the one shown, and there are no
 * others without one shown (#259 review: a step putting a selection back could list one twice).
 */
function tidy(state: EditorSelection): EditorSelection {
  const others = state.others ?? NONE;
  if (others.length === 0) return state;
  if (state.nodeId === null) return { ...state, others: NONE };
  const unique = [...new Set(others)].filter((id) => id !== state.nodeId);
  return unique.length === others.length ? state : { ...state, others: unique };
}

/** Every selected element, the one the canvas shows first. */
export function selectedIds(selection: Pick<EditorSelection, "nodeId" | "others">): string[] {
  return selection.nodeId === null ? [] : [selection.nodeId, ...(selection.others ?? NONE)];
}

/**
 * `selection` with the elements `ids` selected (by the ids the canvas shows them by), the first the
 * one the canvas and the Edit panel show; none for an empty list. For whatever selects several at
 * once, such as *Select similar* (1.35). The editor session writes it (R9).
 */
export function withSelected(selection: EditorSelection, ids: readonly string[]): EditorSelection {
  const unique = [...new Set(ids)];
  return { ...selection, nodeId: unique[0] ?? null, others: unique.slice(1) };
}

/**
 * `selection` with element `id` added, as the one shown, or taken out if it is in it already
 * (Ctrl/Cmd- or Shift-click, 1.31).
 */
export function withToggled(selection: EditorSelection, id: string): EditorSelection {
  const selected = selectedIds(selection);
  return withSelected(
    selection,
    selected.includes(id) ? selected.filter((each) => each !== id) : [id, ...selected],
  );
}
