import type {
  CanvasEngine,
  ComponentLibrary,
  EngineEdit,
  HistoryCommand,
  PageDoc,
  Unsubscribe,
} from "@webforge/engine";
import { createHistoryManager, type HistoryManager, syncDraft } from "@webforge/history";
import { t } from "@webforge/i18n";
import { createStore, type StoreApi } from "zustand/vanilla";

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
 * Connects a mounted canvas engine to the session:
 * - canvas edits become labelled history entries; typing in one text field is one session (D1),
 *   undoable chunk by chunk while it lasts and as one step once the user selects something else;
 * - document changes (undo, redo, jumps) and restored selections go back to the canvas.
 */
export function connectEngine(engine: CanvasEngine, session: EditorSession): Unsubscribe {
  const { history, ui, library } = session;
  let textSession: string | null = null;

  const endTextSession = () => {
    if (textSession !== null) {
      history.endSession(textSession);
      textSession = null;
    }
  };

  const unsubscribers = [
    engine.onUserEdit((edit) => {
      const key =
        edit.kind === "text" && edit.nodeId !== null ? `text:${edit.nodeId}:${edit.field}` : null;
      if (key !== textSession) {
        endTextSession();
      }
      history.run(
        labelFor(edit, library),
        (draft) => {
          syncDraft(draft.page, edit.page);
        },
        { selectionAfter: edit.selection, ...(key === null ? {} : { coalesceKey: key }) },
      );
      textSession = key;
    }),
    engine.onSelectionChange((selection) => {
      endTextSession();
      ui.setState({ selection });
    }),
    engine.onHistoryCommand((command) => runHistoryCommand(history, command)),
    history.document.subscribe((doc) => engine.applyChange({ page: doc.page })),
    ui.subscribe((state) => engine.select(state.selection)),
  ];

  return () => {
    endTextSession();
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
