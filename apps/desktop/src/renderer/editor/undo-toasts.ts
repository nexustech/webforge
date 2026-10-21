import type { HistoryEntry, HistoryManager } from "@webforge/history";
import { t } from "@webforge/i18n";
import type { EditKind } from "./editor-session.js";

/** How long a toast offers Undo before it goes; Undo stays in the title bar and Ctrl/Cmd+Z. */
export const UNDO_TOAST_DURATION_MS = 6_000;

/** The kinds of change that announce themselves with an Undo toast (D4: deleting, unconfirmed). */
const ANNOUNCED: ReadonlySet<EditKind> = new Set(["remove"]);

type ToastId = string | number;

/** Shows and hides toasts: `toast` and `toast.dismiss` from `@webforge/editor-ui`, or test fakes. */
export type Toasts = {
  show(
    message: string,
    options: {
      readonly duration: number;
      readonly action: { readonly label: string; readonly onClick: () => void };
      /** Called when the toast goes, however it goes (timeout, close, dismiss). */
      readonly onDismiss: () => void;
      readonly onAutoClose: () => void;
    },
  ): ToastId;
  dismiss(id: ToastId): void;
};

/** The history operations Undo from a toast needs. */
type UndoableHistory = Pick<HistoryManager<unknown, unknown>, "undo" | "jumpTo" | "state">;

/** What the toasts need of an editor session: its history and its new-entry notifications. */
type ToastSession = {
  readonly history: UndoableHistory;
  onEntryAdded(
    listener: (entry: Pick<HistoryEntry<unknown>, "id" | "label">, kind: EditKind) => void,
  ): () => void;
};

/** Whether the step `entryId` is still applied (exists and is at or before the current one). */
function isApplied(history: UndoableHistory, entryId: string): boolean {
  const { entries, cursor } = history.state.getState();
  const index = entries.findIndex((entry) => entry.id === entryId);
  return index !== -1 && index < cursor;
}

/**
 * Undoes the step `entryId` from its toast (D4). While it is still the current step, that is a
 * plain Undo. After later edits, it jumps to just before it, undoing those too (they stay
 * redoable in Undo History). If the step was undone, or then discarded by a new edit, nothing
 * happens. Returns whether anything changed (nothing does while a gesture is in progress).
 */
export function undoEntry(history: UndoableHistory, entryId: string): boolean {
  if (!isApplied(history, entryId)) {
    return false;
  }
  const { entries, cursor } = history.state.getState();
  const index = entries.findIndex((entry) => entry.id === entryId);
  if (index === cursor - 1) {
    return history.undo();
  }
  return history.jumpTo(entries[index - 1]?.id ?? null);
}

/**
 * Shows "Deleted Heading · Undo" after each delete (D4). `flush` ends a text edit in progress
 * first, so Undo acts on what the person sees. A toast closes as soon as its step is undone some
 * other way (Ctrl/Cmd+Z, Undo History), so it never offers an Undo that would do nothing.
 * Returns a function that stops the toasts.
 */
export function installUndoToasts(
  session: ToastSession,
  toasts: Toasts,
  flush: () => void = () => undefined,
): () => void {
  const watchers = new Set<() => void>();
  const stopAdded = session.onEntryAdded((entry, kind) => {
    if (!ANNOUNCED.has(kind)) {
      return;
    }
    let stopWatching: () => void = () => undefined;
    const forget = () => {
      stopWatching();
      watchers.delete(forget);
    };
    const id = toasts.show(entry.label, {
      duration: UNDO_TOAST_DURATION_MS,
      action: {
        label: t("editor.undo"),
        onClick: () => {
          flush();
          undoEntry(session.history, entry.id);
        },
      },
      onDismiss: forget,
      onAutoClose: forget,
    });
    stopWatching = session.history.state.subscribe(() => {
      if (!isApplied(session.history, entry.id)) {
        forget();
        toasts.dismiss(id);
      }
    });
    watchers.add(forget);
  });
  return () => {
    stopAdded();
    for (const forget of [...watchers]) forget();
  };
}
