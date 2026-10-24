import type { HistoryManager } from "@webforge/history";

/** The history operations undoing back to a step needs. */
export type UndoableHistory = Pick<HistoryManager<unknown, unknown>, "undo" | "jumpTo" | "state">;

/** Whether the step `entryId` is still applied (exists and is at or before the current one). */
export function isApplied(history: UndoableHistory, entryId: string): boolean {
  const { entries, cursor } = history.state.getState();
  const index = entries.findIndex((entry) => entry.id === entryId);
  return index !== -1 && index < cursor;
}

/**
 * Undoes the step `entryId`, from its toast (D4) or the title bar's list of steps (UX-16). While
 * it is still the current step, that is a plain Undo. After later edits, it jumps to just before
 * it, undoing those too (they stay redoable in Undo History). If the step was undone, or then discarded by a new edit, nothing
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
