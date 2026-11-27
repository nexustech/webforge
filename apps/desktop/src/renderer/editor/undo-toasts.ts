import type { HistoryEntry } from "@webforge/history";
import { t } from "@webforge/i18n";
import type { Announcement, EditKind } from "./editor-session.js";
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
      /** The toast this one replaces, showing or not: one for a run of changes (M1). */
      readonly id?: string;
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
    listener: (
      entry: Pick<HistoryEntry<unknown>, "id" | "label">,
      kind: EditKind,
      announced: Announcement,
    ) => void,
  ): () => void;
};

/**
 * Shows "Deleted Heading · Undo" after each delete (D4), and after an edit that asks for it, such as
 * Site Check's *Fix* ("Added page 'Privacy' · Undo", #1164), in its own words if it gives them
 * ("Brand colour changed on 6 pages · Undo", LF-15), or in place of the toast it names
 * ("Changed every Button on your site (12) · Undo", M1). `flush` ends a text edit in progress
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
  /** What watches the step of each toast shown with an id: replaced, it stops. */
  const named = new Map<string, () => void>();
  const stopAdded = session.onEntryAdded((entry, kind, announced) => {
    if (announced === false && !ANNOUNCED.has(kind)) {
      return;
    }
    const replaces = typeof announced === "object" ? announced.id : undefined;
    if (replaces !== undefined) named.get(replaces)?.();
    let stopWatching: () => void = () => undefined;
    const forget = () => {
      stopWatching();
      watchers.delete(forget);
      if (replaces !== undefined && named.get(replaces) === forget) named.delete(replaces);
    };
    const message =
      typeof announced === "string"
        ? announced
        : typeof announced === "object"
          ? announced.message
          : entry.label;
    const id = toasts.show(message, {
      ...(replaces === undefined ? {} : { id: replaces }),
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
    if (replaces !== undefined) named.set(replaces, forget);
  });
  return () => {
    stopAdded();
    for (const forget of [...watchers]) forget();
  };
}
