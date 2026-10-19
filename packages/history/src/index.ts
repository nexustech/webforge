export type { Patch } from "immer";
export { compactPatches } from "./compact-patches.js";
export type {
  CommitOptions,
  HistoryEntry,
  HistoryErrorCode,
  HistoryManager,
  HistoryManagerOptions,
  HistoryState,
  ReadonlyStore,
  Recipe,
  RunOptions,
  SelectionAdapter,
  Transaction,
} from "./history-manager.js";
export { createHistoryManager, HistoryError } from "./history-manager.js";
export { syncDraft } from "./sync-draft.js";
