import type {
  CanvasEngine,
  EngineEditKind,
  HistoryCommand,
  Unsubscribe,
  Viewport,
} from "@webforge/engine";
import {
  type CommitOptions,
  createHistoryManager,
  type HistoryEntry,
  type HistoryManager,
  type ReadonlyStore,
  type Recipe,
  type RunOptions,
  syncDraft,
} from "@webforge/history";
import { t } from "@webforge/i18n";
import type { PageDoc, PageEntry, PageId, SiteDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { applyPatch } from "./apply-patch.js";
import { labelFor } from "./labels.js";
import {
  createSelectionStore,
  type EditorSelection,
  selectElements,
  toggleSelected,
} from "./selection.js";
import { shownLayout } from "./shared-layout.js";
import { undoEntry } from "./undo-entry.js";

export type { EditorSelection } from "./selection.js";

/** What kind of change an entry records; 1.11's Undo toasts pick the ones they announce. */
export type EditKind = EngineEditKind;

/** Called for each new history entry (not for edits that merge into the current one). */
type EntryListener = (entry: HistoryEntry<EditorSelection>, kind: EditKind) => void;

/**
 * A gesture in progress, such as a slider drag: its updates show live and become one undo step on
 * `commit`; `cancel` (or Esc) puts the document back as it was (U2).
 */
export type Gesture = {
  readonly active: boolean;
  update(recipe: Recipe<SiteDoc>): void;
  commit(options?: CommitOptions<EditorSelection>): void;
  cancel(): void;
};

/**
 * Options of {@link EditorSession.edit}: the history's, and `apply` to show `selectionAfter` now
 * (the element the change made or moved), as undo and redo will show it again.
 */
type EditOptions = RunOptions<EditorSelection> & { readonly apply?: boolean };

/**
 * Everything one open site needs: its history (which owns the document) and the UI store. The UI
 * store is read-only to the rest of the editor: the selection, the page and the device view change
 * through {@link EditorSession.select}, {@link EditorSession.showPage},
 * {@link EditorSession.setViewport} and `edit`'s `apply`, which never show a page the site doesn't
 * have (R9).
 */
export type EditorSession = {
  readonly history: HistoryManager<SiteDoc, EditorSelection>;
  readonly ui: ReadonlyStore<EditorSelection>;
  readonly library: ComponentLibrary;
  /** Changes the document as one labelled undo step and tells {@link onEntryAdded} listeners. */
  edit(kind: EditKind, label: string, recipe: Recipe<SiteDoc>, options?: EditOptions): void;
  /** Starts a gesture. A gesture still open from before is committed first. */
  begin(kind: EditKind, label: string): Gesture;
  /** Cancels the gesture in progress; false if there is none. */
  cancelGesture(): boolean;
  onEntryAdded(listener: EntryListener): Unsubscribe;
  /** Shows another page, with nothing selected; not an undo step (U6). */
  showPage(pageId: PageId): void;
  /** Selects `nodeId` (or nothing) alone, on the page shown; not an undo step (U6). */
  select(nodeId: string | null): void;
  /** Selects the elements `ids`, the first the one shown, as *Select similar* does (1.31, 1.35). */
  selectElements(ids: readonly string[]): void;
  /** Adds element `id` to the selection, or takes it out (Ctrl/Cmd- or Shift-click, 1.31). */
  toggleSelected(id: string): void;
  /**
   * Shows a whole selection again (the page, the elements, the view), if its page is still there,
   * as what an action leaves selected; not an undo step (U6).
   */
  restoreSelection(selection: EditorSelection): void;
  /** Shows the canvas as `viewport` would (F-ED-4); not an undo step (U6). */
  setViewport(viewport: Viewport): void;
  /**
   * Ends the canvas's edit in progress (typing, while its grace period runs), so what comes next
   * acts on what the person sees. Does nothing without a canvas.
   */
  flush(): void;
  /** How the canvas ends its edit in progress on {@link flush} ({@link connectEngine}). */
  onFlush(flush: () => void): Unsubscribe;
  /**
   * Undoes back to step `entryId`, that step included, in one jump (UX-16: the title bar's list
   * of steps), after the canvas's edit in progress; a gesture in progress is dropped first, as
   * Ctrl/Cmd+Z drops it. False if the step is gone.
   */
  undoTo(entryId: string): boolean;
};

/**
 * The key that a text-editing session on the canvas (typing in one field of one element) records
 * its steps under, so they merge into one step when it ends (D1).
 */
export function textSessionKey(pageId: PageId, nodeId: string, field: string): string {
  return `text:${pageId}:${nodeId}:${field}`;
}

/** The page the editor shows. */
export function currentPage(session: Pick<EditorSession, "history" | "ui">): PageEntry | undefined {
  return session.history.document.getState().pages[session.ui.getState().pageId];
}

/**
 * Creates the history and UI store for `site`, showing `pageId` (the home page by default). Undo
 * restores the page, selection and device view in the UI store (U3).
 */
export function createEditorSession(
  library: ComponentLibrary,
  site: SiteDoc,
  pageId: PageId = site.homePageId,
): EditorSession {
  const ui = createSelectionStore({ pageId, nodeId: null, viewport: "desktop" });
  const history = createHistoryManager<SiteDoc, EditorSelection>({
    initial: site,
    selection: { get: () => ui.getState(), restore: (selection) => ui.setState(selection, true) },
  });
  const listeners = new Set<EntryListener>();
  const currentEntry = () => {
    const { entries, cursor } = history.state.getState();
    return entries[cursor - 1];
  };
  /** Runs `change` and reports the entry it added, if any. */
  const reporting = (kind: EditKind, change: () => void) => {
    const before = currentEntry();
    change();
    const entry = currentEntry();
    if (entry !== undefined && entry.id !== before?.id) {
      for (const listener of listeners) listener(entry, kind);
    }
  };
  /**
   * Shows `next`, if its page is one the site has: the one way the UI store changes.
   */
  const setSelection = (next: EditorSelection) => {
    if (history.document.getState().pages[next.pageId] !== undefined) ui.setState(next, true);
  };
  /** `selection` with no other selected elements (1.31), left as it is when it has none. */
  const alone = (selection: EditorSelection): EditorSelection =>
    (selection.others ?? []).length > 0 ? { ...selection, others: [] } : selection;
  let gesture: Gesture | null = null;
  /** How the canvas, once there is one, ends its edit in progress. */
  const flushes = new Set<() => void>();
  const flushCanvas = () => {
    for (const flush of flushes) flush();
  };
  /** A canvas edit or another gesture can't wait for a gesture to end: it ends it as it is. */
  const commitGesture = () => {
    if (gesture?.active === true) {
      gesture.commit();
    }
  };
  return {
    history,
    ui,
    library,
    edit(kind, label, recipe, options) {
      commitGesture();
      const { apply, ...runOptions } = options ?? {};
      reporting(kind, () => history.run(label, recipe, runOptions));
      if (apply === true && runOptions.selectionAfter !== undefined) {
        setSelection(runOptions.selectionAfter);
      }
    },
    begin(kind, label) {
      commitGesture();
      const transaction = history.begin(label);
      const started: Gesture = {
        get active() {
          return transaction.active;
        },
        update: (recipe) => transaction.update(recipe),
        commit: (options) => reporting(kind, () => transaction.commit(options)),
        cancel: () => transaction.cancel(),
      };
      gesture = started;
      return started;
    },
    cancelGesture() {
      if (gesture?.active !== true) {
        return false;
      }
      gesture.cancel();
      return true;
    },
    onEntryAdded(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    showPage(next) {
      if (next !== ui.getState().pageId)
        setSelection({ ...alone(ui.getState()), pageId: next, nodeId: null });
    },
    select(nodeId) {
      // Selecting one element alone also ends a multi-selection (1.31).
      const { nodeId: shown, others = [] } = ui.getState();
      if (nodeId !== shown || others.length > 0) setSelection({ ...alone(ui.getState()), nodeId });
    },
    selectElements(ids) {
      selectElements(ui, ids);
    },
    toggleSelected(id) {
      toggleSelected(ui, id);
    },
    restoreSelection(selection) {
      setSelection(selection);
    },
    setViewport(viewport) {
      if (viewport !== ui.getState().viewport) setSelection({ ...ui.getState(), viewport });
    },
    flush: flushCanvas,
    onFlush(flush) {
      flushes.add(flush);
      return () => {
        flushes.delete(flush);
      };
    },
    undoTo(entryId) {
      flushCanvas();
      if (gesture?.active === true) gesture.cancel();
      return undoEntry(history, entryId);
    },
  };
}

/**
 * Runs a history command from the keyboard or the toolbar. Returns true if it did something with
 * it (undo and redo always count; Esc only when it cancelled a gesture). Undo in the middle of a
 * gesture undoes the gesture itself.
 */
export function runHistoryCommand(session: EditorSession, command: HistoryCommand): boolean {
  switch (command) {
    case "undo":
      if (!session.cancelGesture()) {
        session.history.undo();
      }
      return true;
    case "redo":
      session.history.redo();
      return true;
    case "cancel":
      return session.cancelGesture();
  }
}

/**
 * How long a text session stays open after the selection moves away. Puck saves rich text with a
 * debounce of up to 200 ms, so its last keystrokes can arrive after the click that ends the
 * session; they still belong to it (ADR 0004).
 */
export const TEXT_SESSION_GRACE_MS = 300;

/**
 * A pause in typing on the canvas that starts a new undo chunk of the text session, as long as the
 * history's coalescing window. Timed by the keystrokes (the engine's `typingPauseMs`), as Puck's
 * text can arrive much later than it was typed on a busy computer (#307).
 */
export const TYPING_PAUSE_MS = 1000;

/** A canvas engine connected to an {@link EditorSession}; see {@link connectEngine}. */
export type EngineConnection = {
  /** Ends a text session whose grace period is still running, before undo, redo or a jump. */
  flush(): void;
  disconnect(): void;
};

/**
 * Connects a mounted canvas engine to the session:
 * - canvas edits become labelled history entries; typing in one text field is one session (D1),
 *   undoable chunk by chunk while it lasts and as one step once the user selects something else;
 * - document changes (undo, redo, jumps) and restored selections go back to the canvas.
 */
export function connectEngine(engine: CanvasEngine, session: EditorSession): EngineConnection {
  const { history, ui, library } = session;
  let textSession: string | null = null;
  let pendingEnd: ReturnType<typeof setTimeout> | null = null;
  /** True while the engine loads another page: its selection reset is not the user's. */
  let loading = false;

  const endTextSession = () => {
    if (pendingEnd !== null) {
      clearTimeout(pendingEnd);
      pendingEnd = null;
    }
    if (textSession !== null) {
      history.endSession(textSession);
      textSession = null;
    }
  };

  const flush = () => {
    if (pendingEnd !== null) {
      endTextSession();
    }
  };

  const pageDoc = (site: SiteDoc, pageId: PageId): PageDoc | undefined => site.pages[pageId]?.doc;

  const unsubscribers = [
    session.onFlush(() => flush()),
    engine.onUserEdit((edit) => {
      const { pageId, viewport } = ui.getState();
      const page = pageDoc(history.document.getState(), pageId);
      if (page === undefined) {
        return;
      }
      const key =
        edit.kind === "text" && edit.nodeId !== null && edit.field !== null
          ? textSessionKey(pageId, edit.nodeId, edit.field)
          : null;
      // Typing chunked by the user's own pauses, whenever the edit arrives. One with no keystrokes
      // of its own (the rest of what was typed, or text put in from a menu) continues an open
      // session's chunk: when edits arrive says nothing about pauses (#307).
      const continues = key !== null && key === textSession;
      const pause = key === null ? undefined : (edit.typingPauseMs ?? (continues ? 0 : undefined));
      if (key !== textSession) {
        endTextSession();
      }
      if (pause !== undefined && pause > TYPING_PAUSE_MS) history.breakCoalescing();
      const { patch, sharedSection, copyOf } = edit;
      // An edit inside a copy, or another copy placed (F-ED-23): named by its shared section.
      const sharedOf = sharedSection?.id ?? copyOf;
      const sharedName =
        sharedOf === undefined
          ? undefined
          : history.document.getState().sharedSections[sharedOf]?.name;
      const named = sharedName === undefined ? "" : t("history.namedItem", { name: sharedName });
      session.edit(
        edit.kind,
        sharedName === undefined
          ? labelFor(edit, library, page)
          : copyOf === undefined
            ? t("history.editedSharedSection", { name: named })
            : t("history.addedSharedCopy", { name: named }),
        (draft) => {
          if (sharedSection !== undefined) {
            // Inside a linked copy (F-ED-23): its shared section, which every copy shows.
            const entry = draft.sharedSections[sharedSection.id];
            if (entry !== undefined) syncDraft(entry.section, sharedSection.section);
            return;
          }
          if (edit.shared === true && edit.layout !== undefined) {
            // The shared Header or Footer (F-ED-7): the site's layout, which every page shows. Not a
            // region this page hides: the canvas showed none, so the edit can't be to it.
            const shown = shownLayout(history.document.getState(), pageId);
            for (const region of ["header", "footer"] as const) {
              if (shown[region].length > 0) syncDraft(draft.layout[region], edit.layout[region]);
            }
            return;
          }
          const target = draft.pages[pageId];
          // A one-field edit is written directly; anything else is compared with the whole page.
          if (
            target !== undefined &&
            (patch === undefined || !applyPatch(target.doc, page, patch))
          ) {
            syncDraft(target.doc, edit.page);
          }
        },
        {
          // A text edit shows its own element, even when it arrives after the user clicked away.
          selectionAfter: { pageId, viewport, nodeId: key === null ? edit.selection : edit.nodeId },
          ...(key === null ? {} : { coalesceKey: key }),
          ...(pause === undefined ? {} : { coalesceWindowMs: Number.POSITIVE_INFINITY }),
        },
      );
      textSession = key;
    }),
    engine.onSelectionChange((nodeId, adding) => {
      if (loading) {
        return;
      }
      if (textSession !== null && pendingEnd === null) {
        pendingEnd = setTimeout(endTextSession, TEXT_SESSION_GRACE_MS);
      }
      // Ctrl/Cmd- or Shift-click: one more selected element, or one fewer (1.31).
      if (adding && nodeId !== null) session.toggleSelected(nodeId);
      else session.select(nodeId);
    }),
    // A device view chosen on the canvas; not a history step (U6).
    engine.onViewportChange((viewport) => session.setViewport(viewport)),
    engine.onHistoryCommand((command) => {
      flush();
      return runHistoryCommand(session, command);
    }),
    // Undo restores the document before the selection, so this shows the change on the page the
    // canvas has; a change on another page arrives with the page switch below.
    history.document.subscribe((site) => {
      const page = pageDoc(site, ui.getState().pageId);
      if (page !== undefined) {
        // With the shared Header and Footer: undoing an edit of one shows on every page (F-ED-7).
        engine.applyChange({
          page,
          layout: shownLayout(site, ui.getState().pageId),
          shared: site.sharedSections,
        });
      }
    }),
    ui.subscribe((state, previous) => {
      if (state.pageId !== previous.pageId) {
        // Leaving the page ends its text session; when undo shows another page, just after the
        // history has finished changing, which can't be changed again from inside it (#238).
        const leaving = textSession;
        if (!history.isChanging()) {
          endTextSession();
        } else if (leaving !== null) {
          queueMicrotask(() => {
            if (textSession === leaving) endTextSession();
          });
        }
        const site = history.document.getState();
        const page = pageDoc(site, state.pageId);
        if (page !== undefined) {
          loading = true;
          try {
            engine.loadPage(page, shownLayout(site, state.pageId), site.sharedSections);
          } finally {
            loading = false;
          }
        }
      }
      if (state.viewport !== previous.viewport) {
        engine.setViewport(state.viewport);
      }
      engine.select(state.nodeId);
      if (state.others !== previous.others) engine.showSelected(state.others ?? []);
    }),
  ];

  return {
    flush,
    disconnect: () => {
      endTextSession();
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}
