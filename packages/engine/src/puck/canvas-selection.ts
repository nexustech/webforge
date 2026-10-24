import type { PuckAction } from "@puckeditor/core";
import type { PageDoc } from "@webforge/model";
import type { Unsubscribe } from "../canvas-engine.js";
import { emitter, type PuckApi } from "./engine-support.js";
import { showAlsoSelected, watchAddingClicks } from "./selection-clicks.js";
import { findNode } from "./tree.js";

/**
 * The canvas's selection (1.12, 1.31): what Puck selects, reported to the app, and what the app
 * selects, shown in Puck. Puck selects one element; the others selected with it are the app's,
 * outlined on the canvas too.
 */
export type CanvasSelection = {
  /** The element selected, as the app last heard. */
  current(): string | null;
  /** Puck selected `id`: reported to the app if it changed, as adding if a Ctrl/Cmd/Shift-click did it. */
  report(id: string | null): void;
  /** Selects `id` in Puck, as the app asks. */
  select(id: string | null): void;
  /** Shows the selection in Puck again, as Puck selects by position. */
  show(): void;
  /** Drops the selection if `page` no longer has it, telling the app. */
  keepIn(page: PageDoc): void;
  /** Watches clicks that add to the selection in `target` (see `selection-clicks.ts`). */
  watchClicks(target: Window): () => void;
  /** The other selected elements, outlined in `document` too. */
  showOthers(others: readonly string[], document: Document | undefined): void;
  /** Outlines the other selected elements in `document`, the canvas's new document. */
  outlineOthers(document: Document): void;
  /** Whether several elements are selected, and when that changes (the quick actions). */
  readonly several: { get(): boolean; subscribe(cb: () => void): Unsubscribe };
  /** Calls `cb` with each change: `adding` for a Ctrl/Cmd/Shift-click that adds or takes away. */
  onChange(cb: (id: string | null, adding: boolean) => void): Unsubscribe;
};

/** Where Puck finds an element: its zone and index. */
type ItemSelector = NonNullable<ReturnType<PuckApi["getSelectorForId"]>>;

/**
 * A new {@link CanvasSelection}, showing selections in Puck through `dispatch` and finding the
 * element with `selectorFor` (null before Puck is ready).
 */
export function createCanvasSelection(
  dispatch: (action: PuckAction) => void,
  selectorFor: (id: string) => ItemSelector | null,
): CanvasSelection {
  let selection: string | null = null;
  /** The element a Ctrl/Cmd/Shift-click is on, which Puck is about to select (1.31). */
  let addingClick: string | null = null;
  let others: readonly string[] = [];
  const othersChanged = emitter<void>();
  const changes = emitter<{ readonly id: string | null; readonly adding: boolean }>();

  const show = () =>
    dispatch({
      type: "setUi",
      ui: { itemSelector: selection === null ? null : selectorFor(selection) },
    });

  return {
    current: () => selection,
    report(id) {
      if (id !== selection) {
        selection = id;
        const adding = id !== null && id === addingClick;
        addingClick = null;
        changes.emit({ id, adding });
      }
    },
    select(id) {
      if (id === selection) return;
      selection = id;
      show();
    },
    show,
    keepIn(page) {
      if (selection !== null && findNode(page, selection) === undefined) {
        selection = null;
        changes.emit({ id: null, adding: false });
      }
    },
    watchClicks: (target) =>
      watchAddingClicks(target, (id) => {
        // On the element selected already, Puck selects nothing new: it is reported here.
        if (id !== null && id === selection) {
          addingClick = null;
          changes.emit({ id, adding: true });
        } else {
          addingClick = id;
        }
      }),
    showOthers(next, document) {
      others = next;
      if (document !== undefined) showAlsoSelected(document, next);
      othersChanged.emit();
    },
    outlineOthers: (document) => showAlsoSelected(document, others),
    several: { get: () => others.length > 0, subscribe: othersChanged.add },
    onChange: (cb) => changes.add(({ id, adding }) => cb(id, adding)),
  };
}
