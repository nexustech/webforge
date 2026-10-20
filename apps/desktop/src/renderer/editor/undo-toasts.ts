import type { HistoryEntry, HistoryManager } from "@webforge/history";
import { t } from "@webforge/i18n";
import type { EditKind } from "./editor-session.js";

/** How long a toast offers Undo before it goes; Undo stays in the title bar and Ctrl/Cmd+Z. */
export const UNDO_TOAST_DURATION_MS = 6_000;

/** The kinds of change that announce themselves with an Undo toast (D4: deleting, unconfirmed). */
const ANNOUNCED: ReadonlySet<EditKind> = new Set(["remove"]);

/** Shows a toast; `toast()` from `@webforge/editor-ui`, injectable for tests. */
export type ShowToast = (
  message: string,
  options: {
    readonly duration: number;
    readonly action: { readonly label: string; readonly onClick: () => void };
  },
) => unknown;

/** The history operations Undo from a toast needs. */
type UndoableHistory = Pick<HistoryManager<unknown, unknown>, "undo" | "jumpTo" | "state">;

/** What the toasts need of an editor session: its history and its new-entry notifications. */
type ToastSession = {
  readonly history: UndoableHistory;
  onEntryAdded(
    listener: (entry: Pick<HistoryEntry<unknown>, "id" | "label">, kind: EditKind) => void,
  ): () => void;
};

/**
 * Undoes the step `entryId` from its toast (D4). While it is still the current step, that is a
 * plain Undo. After later edits, it jumps to just before it, undoing those too (they stay
 * redoable in Undo History). If the step was undone and then discarded by a new edit, there is
 * nothing left to undo and nothing happens. Returns whether anything changed.
 */
export function undoEntry(history: UndoableHistory, entryId: string): boolean {
  const { entries, cursor } = history.state.getState();
  const index = entries.findIndex((entry) => entry.id === entryId);
  if (index === -1 || index >= cursor) {
    // Gone, or already undone.
    return false;
  }
  if (index === cursor - 1) {
    history.undo();
    return true;
  }
  return history.jumpTo(entries[index - 1]?.id ?? null);
}

/**
 * Shows "Deleted Heading · Undo" after each delete (D4). `flush` ends a text edit in progress
 * first, so Undo acts on what the person sees. Returns a function that stops the toasts.
 */
export function installUndoToasts(
  session: ToastSession,
  show: ShowToast,
  flush: () => void = () => undefined,
): () => void {
  return session.onEntryAdded((entry, kind) => {
    if (!ANNOUNCED.has(kind)) {
      return;
    }
    show(entry.label, {
      duration: UNDO_TOAST_DURATION_MS,
      action: {
        label: t("editor.undo"),
        onClick: () => {
          flush();
          undoEntry(session.history, entry.id);
        },
      },
    });
  });
}
