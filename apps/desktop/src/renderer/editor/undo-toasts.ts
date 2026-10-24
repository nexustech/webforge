import type { HistoryEntry } from "@webforge/history";
import { t } from "@webforge/i18n";
import type { EditKind } from "./editor-session.js";
import { isApplied, type UndoableHistory, undoEntry } from "./undo-entry.js";

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

/** What the toasts need of an editor session: its history and its new-entry notifications. */
type ToastSession = {
  readonly history: UndoableHistory;
  onEntryAdded(
    listener: (entry: Pick<HistoryEntry<unknown>, "id" | "label">, kind: EditKind) => void,
  ): () => void;
};

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
