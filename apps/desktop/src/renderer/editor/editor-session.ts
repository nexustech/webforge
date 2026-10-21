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
  type Recipe,
  type RunOptions,
  syncDraft,
} from "@webforge/history";
import type { PageDoc, PageEntry, PageId, SiteDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { createStore, type StoreApi } from "zustand/vanilla";
import { applyPatch } from "./apply-patch.js";
import { labelFor } from "./labels.js";

/**
 * What undo shows again (U3): the page, the selected element and the device view. It is also the
 * UI state (U6): changing it is never an undo step.
 */
export type EditorSelection = {
  readonly pageId: PageId;
  readonly nodeId: string | null;
  readonly viewport: Viewport;
};

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

/** Everything one open site needs: its history (which owns the document) and the UI store. */
export type EditorSession = {
  readonly history: HistoryManager<SiteDoc, EditorSelection>;
  readonly ui: StoreApi<EditorSelection>;
  readonly library: ComponentLibrary;
  /** Changes the document as one labelled undo step and tells {@link onEntryAdded} listeners. */
  edit(
    kind: EditKind,
    label: string,
    recipe: Recipe<SiteDoc>,
    options?: RunOptions<EditorSelection>,
  ): void;
  /** Starts a gesture. A gesture still open from before is committed first. */
  begin(kind: EditKind, label: string): Gesture;
  /** Cancels the gesture in progress; false if there is none. */
  cancelGesture(): boolean;
  onEntryAdded(listener: EntryListener): Unsubscribe;
  /** Shows another page; not an undo step. */
  showPage(pageId: PageId): void;
};

/** The page the editor shows. */
export function currentPage(session: EditorSession): PageEntry | undefined {
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
  const ui = createStore<EditorSelection>()(() => ({ pageId, nodeId: null, viewport: "desktop" }));
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
  let gesture: Gesture | null = null;
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
      reporting(kind, () => history.run(label, recipe, options));
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
      if (next !== ui.getState().pageId && history.document.getState().pages[next] !== undefined) {
        ui.setState({ pageId: next, nodeId: null });
      }
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
    engine.onUserEdit((edit) => {
      const { pageId, viewport } = ui.getState();
      const page = pageDoc(history.document.getState(), pageId);
      if (page === undefined) {
        return;
      }
      const key =
        edit.kind === "text" && edit.nodeId !== null
          ? `text:${pageId}:${edit.nodeId}:${edit.field}`
          : null;
      if (key !== textSession) {
        endTextSession();
      }
      const { patch } = edit;
      session.edit(
        edit.kind,
        labelFor(edit, library, page),
        (draft) => {
          if (edit.shared === true && edit.layout !== undefined) {
            // The shared Header or Footer (F-ED-7): the site's layout, which every page shows.
            syncDraft(draft.layout, edit.layout);
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
        },
      );
      textSession = key;
    }),
    engine.onSelectionChange((nodeId) => {
      if (loading) {
        return;
      }
      if (textSession !== null && pendingEnd === null) {
        pendingEnd = setTimeout(endTextSession, TEXT_SESSION_GRACE_MS);
      }
      ui.setState({ nodeId });
    }),
    // A device view chosen on the canvas; not a history step (U6).
    engine.onViewportChange((viewport) => ui.setState({ viewport })),
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
        engine.applyChange({ page, layout: site.layout });
      }
    }),
    ui.subscribe((state, previous) => {
      if (state.pageId !== previous.pageId) {
        endTextSession();
        const site = history.document.getState();
        const page = pageDoc(site, state.pageId);
        if (page !== undefined) {
          loading = true;
          try {
            engine.loadPage(page, site.layout);
          } finally {
            loading = false;
          }
        }
      }
      if (state.viewport !== previous.viewport) {
        engine.setViewport(state.viewport);
      }
      engine.select(state.nodeId);
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
