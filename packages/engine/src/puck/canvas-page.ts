import type { AppState, PuckAction } from "@puckeditor/core";
import type { NodeDoc, PageDoc, SharedCopyNode } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import type { EngineEdit, Unsubscribe } from "../canvas-engine.js";
import type { CanvasSelection } from "./canvas-selection.js";
import type { CanvasSync } from "./canvas-sync.js";
import { preserveCaret, refocusRichText } from "./caret.js";
import { copyDrop, planCopyDrop } from "./copy-drop.js";
import type { DeferredCommands } from "./deferred-commands.js";
import type { DragKeys, Drop } from "./drag-copies.js";
import { editFromAction, selectedNodeId, toPageDoc } from "./edit-from-action.js";
import { remountStale } from "./editor-revisions.js";
import { EMPTY_PAGE, emitter, type PuckHandle, toPuckData } from "./engine-support.js";
import { pageActions, type SlotsOf } from "./page-actions.js";
import { type CanvasDocs, type RoutedEdit, routeEdit, routeLinkedCopy } from "./route-edit.js";
import { composePage, EMPTY_LAYOUT, sameOrder } from "./shared-layout.js";
import { focusedRichTextId } from "./stale-rich-text.js";
import type { TypingPauses } from "./typing-pauses.js";

/** What {@link createCanvasPage} works with. */
export type CanvasPageOptions = {
  /** Which page Puck shows, and whose change is under way. */
  readonly sync: CanvasSync;
  /** Puck, once it is ready. */
  readonly puck: PuckHandle;
  /** Sends an action to Puck (see `CanvasSync.apply`). */
  readonly dispatch: (action: PuckAction) => void;
  /** The library the canvas was mounted with, once it is. */
  readonly library: () => ComponentLibrary | null;
  /** The names of a component type's slot fields. */
  readonly slotsOf: SlotsOf;
  readonly selection: CanvasSelection;
  /** Undo or Redo waiting for an edit to be recorded (see `deferredCommands`). */
  readonly commands: Pick<DeferredCommands, "edited">;
  /** The pauses in typing, which split typing into undo steps (#307). */
  readonly pauses: TypingPauses;
  /** The keys held while dragging on the canvas: Ctrl or Cmd copies (see `drag-copies.ts`). */
  readonly dragKeys: DragKeys;
  /** Per node, bumped to remount its rich-text editors (see `toPuckConfig`). */
  readonly editorRevisions: Map<string, number>;
  /** The canvas iframe's document, once Puck has created it. */
  readonly frameDocument: () => Document | null;
};

/**
 * The page, shared Header and Footer (F-ED-7) and shared sections (F-ED-23) as the app and Puck
 * both see them (R8, ADR 0004): the app's changes shown in Puck as the fewest actions, and Puck's
 * actions reported as the app's edits, routed to where they belong (see `routeEdit`).
 */
export type CanvasPage = {
  /**
   * The page, layout and shared sections as the app last gave them (`load`, `apply`) or as Puck
   * last reported them. Kept as the app's own objects, so its next change can be recognised.
   */
  docs(): CanvasDocs;
  /** The page as Puck shows it: the Header and Footer around the page's content. */
  composed(): PageDoc;
  /** Sends the whole page to Puck, unless Puck isn't ready yet (the Bridge sends it once it is). */
  show(): void;
  /** Puck's `onAction`: its action reported to the app as an edit, if it is one. */
  handleAction(action: PuckAction, next: AppState, prev: AppState): void;
  /** Shows a page the app opened, with nothing selected. */
  load(docs: CanvasDocs): void;
  /** Shows the app's change (an undo, a redo, an edit from a panel), keeping the selection. */
  apply(docs: CanvasDocs): void;
  /** Calls `cb` with each edit Puck made, as the document store will take it over. */
  onEdit(cb: (edit: EngineEdit) => void): Unsubscribe;
};

/** A new {@link CanvasPage}, showing an empty page until the app loads one. */
export function createCanvasPage(options: CanvasPageOptions): CanvasPage {
  const { sync, puck, dispatch, library, slotsOf, selection, commands, pauses, dragKeys } = options;
  let docs: CanvasDocs = { page: EMPTY_PAGE, layout: EMPTY_LAYOUT, shared: {} };
  const edits = emitter<EngineEdit>();
  const composed = () => composePage(docs.page, docs.layout, docs.shared);

  const show = () => {
    if (puck() !== null) {
      dispatch({ type: "setData", data: () => toPuckData(composed()), recordHistory: false });
      sync.shown();
    }
  };

  /** Sends `actions` to Puck, kept out of its own history. */
  const dispatchAll = (actions: readonly PuckAction[]) => {
    for (const action of actions) dispatch({ ...action, recordHistory: false });
  };

  /**
   * Puts Puck's view back in step with the docs, from `shown`, what Puck shows now: the Header and
   * Footer in their places, the page's content between them (F-ED-7). With `whenOutOfOrder`, only
   * if their top-level order differs. Runs after Puck's own update, where a dispatch would be lost.
   */
  const putBack = (shown: PageDoc, whenOutOfOrder = false) => {
    queueMicrotask(() => {
      const wanted = composed();
      if (puck() === null || (whenOutOfOrder && sameOrder(shown, wanted))) return;
      const actions = pageActions(shown, wanted, slotsOf);
      if (actions === null) {
        show();
      } else {
        dispatchAll(actions);
      }
    });
  };

  /** Reports `edit` to the app, as the document store will take it over. */
  const emitEdit = (edit: EngineEdit) =>
    sync.report(() => {
      const typingPauseMs = edit.kind === "text" ? pauses.take() : undefined;
      edits.emit(typingPauseMs === undefined ? edit : { ...edit, typingPauseMs });
    });

  /**
   * Takes over `routed`, where an edit goes (see `routeEdit`): the docs with it, the edit reported to
   * the app, and Puck's view put back in step from `shown`.
   */
  const follow = (routed: RoutedEdit, shown: PageDoc) => {
    docs = routed.next;
    if (routed.emit !== undefined) emitEdit(routed.emit);
    putBack(shown, routed.putBack === "whenOutOfOrder");
  };

  /** Reports an edit Puck made to the page as the canvas shows it (see `routeEdit`). */
  const reportEdit = (edit: EngineEdit, action: PuckAction, prev: AppState) =>
    follow(routeEdit(edit, action, prev, docs), edit.page);

  /** Another linked copy of `copy`'s section where a drag of it dropped (see `routeLinkedCopy`). */
  const placeLinkedCopy = (copy: NodeDoc & SharedCopyNode, drop: Drop, shown: PageDoc) =>
    follow(routeLinkedCopy(copy, drop, docs), shown);

  /**
   * Carries out a drop with Ctrl or Cmd held (see `planCopyDrop`), once Puck has moved what was
   * dragged (`next`): its view put right, the original back and the copy shown, and the copy
   * reported as one step.
   */
  const copyOnDrop = (
    action: PuckAction,
    drop: Drop,
    next: AppState,
    prev: AppState,
    linked: boolean,
  ) => {
    if (puck() === null || library() === null) return;
    const shown = toPageDoc(next.data);
    const plan = planCopyDrop(drop, linked, prev, docs);
    if (plan.kind === "refuse") {
      putBack(shown);
      return;
    }
    if (plan.kind === "linked") {
      placeLinkedCopy(plan.copy, drop, shown);
    } else {
      const actions = pageActions(shown, plan.after, slotsOf);
      if (actions === null) {
        dispatch({ type: "setData", data: () => toPuckData(plan.after), recordHistory: false });
      } else {
        dispatchAll(actions);
      }
      reportEdit(plan.edit, action, prev);
    }
    commands.edited();
  };

  return {
    docs: () => docs,
    composed,
    show,

    handleAction: (action, next, prev) =>
      sync.handleAction(() => {
        // The echo of Webforge's own dispatch: Puck shows what the app has already.
        if (sync.isEcho()) return;
        const components = library();
        const copying = components === null ? null : copyDrop(action, prev, dragKeys);
        if (copying !== null) {
          // Made once Puck has finished its own update, where a dispatch would be lost.
          const { drop, linked } = copying;
          queueMicrotask(() => copyOnDrop(action, drop, next, prev, linked));
          return;
        }
        if (components !== null) {
          const edit = editFromAction(action, next, prev, components);
          if (edit !== null) {
            reportEdit(edit, action, prev);
            // An Undo or Redo was waiting for this edit: it runs now, outside Puck's own update.
            commands.edited();
          }
        }
        // After the edit, so the history records the selection from before it.
        selection.report(selectedNodeId(next));
      }),

    load(next) {
      docs = next;
      sync.changed();
      options.editorRevisions.clear();
      selection.report(null);
      show();
      selection.show();
    },

    apply(next) {
      if (sync.isReporting()) {
        // The document store just took over the edit Puck reported: same content, nothing to show.
        docs = next;
        return;
      }
      if (next.page === docs.page && next.layout === docs.layout && next.shared === docs.shared) {
        return;
      }
      const frameDocument = options.frameDocument();
      const before = composed();
      const after = composePage(next.page, next.layout, next.shared);
      const components = library();
      // The rich-text editor being typed in, if this change remounts it (Undo while typing).
      const refocus =
        components === null
          ? null
          : remountStale(
              options.editorRevisions,
              components,
              before,
              after,
              focusedRichTextId(frameDocument),
            );
      // Only what changed, unless Puck shows an older page or the change is too big to translate.
      const actions =
        puck() !== null && sync.isShown() ? pageActions(before, after, slotsOf) : null;
      docs = next;
      sync.changed();
      preserveCaret(frameDocument);
      if (refocus !== null) refocusRichText(frameDocument, refocus);
      if (actions === null) {
        show();
      } else {
        dispatchAll(actions);
        sync.shown();
      }
      // Puck selects by position; keep the same element selected, or none if it is gone.
      selection.keepIn(after);
      selection.show();
    },

    onEdit: edits.add,
  };
}
