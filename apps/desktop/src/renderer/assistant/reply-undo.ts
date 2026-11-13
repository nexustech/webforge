/** What Undo History holds, as `HistoryState` gives it: its entries' ids and how many are applied. */
export type HistoryPosition = {
  readonly entries: readonly { readonly id: string }[];
  /** Applied entries: `entries[cursor - 1]` is the current step. */
  readonly cursor: number;
};

/**
 * What *Undo these changes* can do for a reply's steps (ADR 0026 §7, AIA-5):
 * - `undo`: they are the newest applied entries, in order: jumping to `to` (the entry before the
 *   first, or `null` for the start) undoes exactly them, as one undo;
 * - `undone`: none of them is applied any more, as an undo already took them back;
 * - `moved-on`: something has happened since, or some of them are gone: only the conversation's
 *   safety version can take them back now.
 */
export type ReplyUndo =
  | { readonly kind: "undo"; readonly to: string | null }
  | { readonly kind: "undone" }
  | { readonly kind: "moved-on" };

/**
 * Whether and how a reply's steps, by their entry ids, can be undone now. Two steps may name one
 * entry: Undo History merges edits to one field in a row into a single step, so they count once.
 */
export function replyUndo(history: HistoryPosition, stepIds: readonly string[]): ReplyUndo {
  const entryIds = stepIds.filter((id, index) => id !== stepIds[index - 1]);
  const at = history.entries.findIndex((entry) => entry.id === entryIds[0]);
  if (entryIds.length === 0 || at === -1) return { kind: "moved-on" };
  const theirs = history.entries.slice(at, at + entryIds.length).map((entry) => entry.id);
  if (theirs.length !== entryIds.length || theirs.some((id, index) => id !== entryIds[index])) {
    return { kind: "moved-on" };
  }
  if (at + entryIds.length === history.cursor) {
    return { kind: "undo", to: at === 0 ? null : (history.entries[at - 1]?.id ?? null) };
  }
  return history.cursor <= at ? { kind: "undone" } : { kind: "moved-on" };
}
