import type { CanvasEngine, EngineEdit, HistoryCommand } from "@webforge/engine";
import { createHistoryManager, type HistoryManager, syncDraft } from "@webforge/history";
import { t } from "@webforge/i18n";
import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { createStore, type StoreApi } from "zustand/vanilla";
import { applyPatch } from "./apply-patch.js";

/** The document the spike edits: one page. The full Site model arrives with `@webforge/model`. */
export type SpikeDoc = { page: PageDoc };

/** UI state (U6): never part of the document or its history. */
type UiState = { selection: string | null };

/** Everything one open page needs: its history (which owns the document) and the UI store. */
export type EditorSession = {
  readonly history: HistoryManager<SpikeDoc, string | null>;
  readonly ui: StoreApi<UiState>;
  readonly library: ComponentLibrary;
};

/** Creates the history and UI store for `page`. Undo restores the selection in the UI store (U3). */
export function createEditorSession(library: ComponentLibrary, page: PageDoc): EditorSession {
  const ui = createStore<UiState>()(() => ({ selection: null }));
  const history = createHistoryManager<SpikeDoc, string | null>({
    initial: { page },
    selection: {
      get: () => ui.getState().selection,
      restore: (selection) => ui.setState({ selection }),
    },
  });
  return { history, ui, library };
}

/** The undo label for a canvas edit, e.g. "Moved Heading" or "Edited Heading text" (D2). */
export function labelFor(edit: EngineEdit, library: ComponentLibrary): string {
  const component =
    edit.componentType === null ? undefined : library.components[edit.componentType];
  const item = component?.label ?? edit.componentType ?? "";
  switch (edit.kind) {
    case "insert":
      return t("history.added", { item });
    case "move":
      return t("history.moved", { item });
    case "remove":
      return t("history.deleted", { item });
    case "duplicate":
      return t("history.duplicated", { item });
    case "text":
      return t("history.editedText", { item });
    case "props": {
      const field = edit.field === null ? undefined : component?.fields[edit.field];
      return field === undefined
        ? t("history.editedPage")
        : t("history.changed", { item, field: field.label.toLowerCase() });
    }
    case "root":
      return t("history.changedPage");
    case "page":
      return t("history.editedPage");
  }
}

/** Runs an undo or redo command. */
export function runHistoryCommand(
  history: HistoryManager<SpikeDoc, string | null>,
  command: HistoryCommand,
): void {
  if (command === "undo") {
    history.undo();
  } else {
    history.redo();
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

  const unsubscribers = [
    engine.onUserEdit((edit) => {
      const key =
        edit.kind === "text" && edit.nodeId !== null ? `text:${edit.nodeId}:${edit.field}` : null;
      if (key !== textSession) {
        endTextSession();
      }
      const { patch } = edit;
      const page = history.document.getState().page;
      history.run(
        labelFor(edit, library),
        (draft) => {
          // A one-field edit is written directly; anything else is compared with the whole page.
          if (patch === undefined || !applyPatch(draft.page, page, patch)) {
            syncDraft(draft.page, edit.page);
          }
        },
        {
          // A text edit shows its own element, even when it arrives after the user clicked away.
          selectionAfter: key === null ? edit.selection : edit.nodeId,
          ...(key === null ? {} : { coalesceKey: key }),
        },
      );
      textSession = key;
    }),
    engine.onSelectionChange((selection) => {
      if (textSession !== null && pendingEnd === null) {
        pendingEnd = setTimeout(endTextSession, TEXT_SESSION_GRACE_MS);
      }
      ui.setState({ selection });
    }),
    engine.onHistoryCommand((command) => {
      flush();
      runHistoryCommand(history, command);
    }),
    history.document.subscribe((doc) => engine.applyChange({ page: doc.page })),
    ui.subscribe((state) => engine.select(state.selection)),
  ];

  return {
    flush,
    disconnect: () => {
      endTextSession();
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}
