import { WebforgeError } from "@webforge/errors";
import {
  applyPatches,
  type Draft,
  enablePatches,
  freeze,
  type Objectish,
  type Patch,
  produceWithPatches,
} from "immer";
import { createStore, type StoreApi } from "zustand/vanilla";
import { compactPatches } from "./compact-patches.js";

enablePatches();

/** A mutation of the document, written against an Immer draft. */
export type Recipe<D> = (draft: Draft<D>) => void;

/** What every change brings with it; see {@link BaseOptions.finish}. */
export type Finish<D> = (draft: Draft<D>, changes: readonly Patch[]) => void;

/** A Zustand store that can be read and watched but not written. */
export type ReadonlyStore<T> = Pick<StoreApi<T>, "getState" | "getInitialState" | "subscribe">;

/**
 * Connects the history to the app's UI store, which owns the selection (U6: selecting is never an
 * undo step). `S` is whatever the app needs to show a change again: selected element, page,
 * viewport (U3).
 */
export type SelectionAdapter<S> = {
  /** The current selection, recorded before and after each change. */
  get(): S;
  /** Shows a recorded selection again after undo, redo or a jump. */
  restore(selection: S): void;
};

/** One undo step. Plain JSON, so it can later be persisted (D6). */
export type HistoryEntry<S> = {
  readonly id: string;
  /** Human-readable label, already translated (D2), e.g. "Edited Heading text". */
  readonly label: string;
  readonly forward: readonly Patch[];
  readonly inverse: readonly Patch[];
  /** Key that later edits may merge into this entry with, or `null`. */
  readonly coalesceKey: string | null;
  readonly selectionBefore: S;
  readonly selectionAfter: S;
  /** When the entry was created and last extended, in ms since the epoch. */
  readonly createdAt: number;
  readonly updatedAt: number;
};

/** What the Undo History panel and the undo/redo buttons render. */
export type HistoryState<S> = {
  readonly entries: readonly HistoryEntry<S>[];
  /** Number of applied entries: `entries[cursor - 1]` is the current step, later ones are redoable. */
  readonly cursor: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Label of the open transaction, if a gesture is in progress. */
  readonly transaction: string | null;
};

/** Options of {@link HistoryManager.run}. */
export type RunOptions<S> = {
  /**
   * Consecutive runs with the same key merge into one entry while each follows the previous one
   * within the coalescing window (rule 4), e.g. `prop:<id>:padding` while scrubbing a slider.
   */
  readonly coalesceKey?: string;
  /** Overrides the manager's coalescing window for this run, in ms. */
  readonly coalesceWindowMs?: number;
  /** Selection to record as "after" instead of reading it from the adapter. */
  readonly selectionAfter?: S;
};

/** Options of {@link Transaction.commit}. */
export type CommitOptions<S> = {
  /** Replaces the label given to `begin`, e.g. once a drop target is known. */
  readonly label?: string;
  readonly selectionAfter?: S;
};

/**
 * A gesture in progress (drag, slider scrub). Updates apply to the document live but become one
 * undo step only on `commit`; `cancel` restores the document as it was at `begin` (U2).
 */
export interface Transaction<D, S> {
  /** Whether the transaction can still be updated, committed or cancelled. */
  readonly active: boolean;
  update(recipe: Recipe<D>): void;
  commit(options?: CommitOptions<S>): void;
  cancel(): void;
}

/** Owns the document and its undo history. Every document change goes through it. */
export interface HistoryManager<D, S> {
  /** The document. Read-only: change it with `run` or `begin`. */
  readonly document: ReadonlyStore<D>;
  /** Entries and cursor, for the Undo History panel and toolbar. */
  readonly state: ReadonlyStore<HistoryState<S>>;
  /** Applies `recipe` to the document as one undo step labelled `label`. */
  run(label: string, recipe: Recipe<D>, options?: RunOptions<S>): void;
  /** Starts a gesture that becomes at most one undo step. */
  begin(label: string): Transaction<D, S>;
  /** Undoes the current step. Returns false if there is nothing to undo or a gesture is open. */
  undo(): boolean;
  /** Redoes the next step. Returns false if there is nothing to redo or a gesture is open. */
  redo(): boolean;
  /**
   * Undoes or redoes several steps at once, until `entryId` is the current step (D3).
   * `null` jumps back to before the first entry. Returns false for an unknown id or an open gesture.
   */
  jumpTo(entryId: string | null): boolean;
  entries(): readonly HistoryEntry<S>[];
  /** Stops later runs from merging into the current entry, e.g. when the user clicks away. */
  breakCoalescing(): void;
  /**
   * Ends an editing session (D1): merges the run of applied entries with `coalesceKey` that ends at
   * the current step into one entry, and stops later runs from merging into it.
   */
  endSession(coalesceKey: string): void;
  /** Forgets all entries; the document is unchanged. */
  clear(): void;
  /**
   * Whether a change to the history is in progress: a subscriber reacting to it can't change the
   * history too (that throws {@link HistoryError} "reentrant"), and waits until it is done.
   */
  isChanging(): boolean;
}

/** Options of {@link createHistoryManager} other than the selection adapter. */
type BaseOptions<D> = {
  readonly initial: D;
  /** Maximum number of entries kept; the oldest are dropped first (U7). Default 200. */
  readonly limit?: number;
  /**
   * Memory budget for the entries' patches (U7), in characters of their JSON: a cheap stand-in for
   * their size in memory, close to bytes for typical page content. The oldest entries are dropped
   * while the history is over it; the current entry is always kept. Default 50 million, which a
   * large page's insert-and-delete steps reach long before 200 entries would.
   */
  readonly maxBytes?: number;
  /** Default coalescing window in ms. Default 1000. */
  readonly coalesceWindowMs?: number;
  /** Clock, injectable for tests. */
  readonly now?: () => number;
  /**
   * What every change to the document brings with it, in the same step: called after each recipe
   * that changed something, with that recipe's patches, on a draft of the changed document. What
   * it changes is undone and redone with the step: a page's last-changed date (3.15, SEO-3).
   */
  readonly finish?: Finish<D>;
};

/**
 * Options of {@link createHistoryManager}. `selection` is required when `S` isn't `null`: a
 * history that records selections needs to read and restore them.
 */
export type HistoryManagerOptions<D, S> = BaseOptions<D> &
  ([S] extends [null]
    ? { readonly selection?: SelectionAdapter<S> }
    : { readonly selection: SelectionAdapter<S> });

/** Error codes of {@link HistoryError}. */
export type HistoryErrorCode = "transaction-open" | "transaction-closed" | "reentrant";

/** A programming error in the use of the history: people only ever see that something went wrong. */
export class HistoryError extends WebforgeError<HistoryErrorCode> {
  override readonly name = "HistoryError";

  constructor(code: HistoryErrorCode, message: string) {
    super(code, "errors.unexpected", message);
  }
}

const NO_SELECTION: SelectionAdapter<null> = { get: () => null, restore: () => undefined };

/**
 * A store that tells every listener about each change, even when one throws. Zustand's `setState`
 * stops at the first listener that throws, so the ones after it (autosave, the canvas) would miss
 * a change that did happen; `set` rethrows the first error once all have been told.
 */
function createTellingStore<T>(initial: T) {
  const inner = createStore<T>()(() => initial);
  /** What the listeners threw while being told about the change being set. */
  const errors: unknown[] = [];
  const store: ReadonlyStore<T> = {
    getState: inner.getState,
    getInitialState: inner.getInitialState,
    subscribe: (listener) =>
      inner.subscribe((state, previous) => {
        try {
          listener(state, previous);
        } catch (error) {
          errors.push(error);
        }
      }),
  };
  return {
    store,
    getState: inner.getState,
    set(next: T): void {
      errors.length = 0;
      inner.setState(next, true);
      const thrown = errors.splice(0);
      if (thrown.length > 0) throw thrown[0];
    },
  };
}

/**
 * Creates the history manager and the document store it owns. Document edits are Immer recipes;
 * each entry keeps the forward and inverse patches (approach B in research/stack/03-undo-redo.md).
 */
export function createHistoryManager<D extends Objectish>(
  options: HistoryManagerOptions<D, null>,
): HistoryManager<D, null>;
export function createHistoryManager<D extends Objectish, S>(
  options: HistoryManagerOptions<D, S>,
): HistoryManager<D, S>;
export function createHistoryManager<D extends Objectish, S>(
  options: BaseOptions<D> & { readonly selection?: SelectionAdapter<S> },
): HistoryManager<D, S> {
  // Without an adapter S is null (see the type of `selection`).
  const selection = options.selection ?? (NO_SELECTION as unknown as SelectionAdapter<S>);
  const limit = options.limit ?? 200;
  const maxBytes = options.maxBytes ?? 50 * 1024 * 1024;
  const defaultWindow = options.coalesceWindowMs ?? 1000;
  const now = options.now ?? Date.now;

  const { finish } = options;
  /** `recipe` on `base`, then {@link BaseOptions.finish} on what it changed: one set of patches. */
  const produce = (base: D, recipe: Recipe<D>): [D, Patch[], Patch[]] => {
    const [next, forward, inverse] = produceWithPatches(base, (draft) => {
      // Ignore a value returned by mistake (e.g. `draft => draft.list.push(x)`): recipes only mutate.
      recipe(draft);
    });
    if (forward.length === 0 || finish === undefined) return [next as D, forward, inverse];
    const [finished, more, undoMore] = produceWithPatches(next, (draft) => {
      finish(draft, forward);
    });
    return [finished as D, [...forward, ...more], [...undoMore, ...inverse]];
  };

  const documentStore = createTellingStore<D>(freeze(options.initial, true));
  const stateStore = createTellingStore<HistoryState<S>>({
    entries: [],
    cursor: 0,
    canUndo: false,
    canRedo: false,
    transaction: null,
  });

  let entries: HistoryEntry<S>[] = [];
  /** The JSON size of each entry's patches, measured once per entry version. */
  const sizes = new WeakMap<HistoryEntry<S>, number>();
  const sizeOf = (entry: HistoryEntry<S>) => {
    let size = sizes.get(entry);
    if (size === undefined) {
      size = JSON.stringify(entry.forward).length + JSON.stringify(entry.inverse).length;
      sizes.set(entry, size);
    }
    return size;
  };
  /** Drops the oldest entries while over the memory budget, keeping the current one. */
  const enforceBudget = () => {
    let total = entries.reduce((sum, entry) => sum + sizeOf(entry), 0);
    let drop = 0;
    while (total > maxBytes && drop < cursor - 1) {
      total -= sizeOf(entries[drop] as HistoryEntry<S>);
      drop++;
    }
    if (drop > 0) {
      entries = entries.slice(drop);
      cursor -= drop;
    }
  };
  let cursor = 0;
  let nextId = 1;
  /** Key that the next run may merge into the current entry with. */
  let openChain: string | null = null;
  let transaction: { label: string } | null = null;

  const publish = () => {
    enforceBudget();
    stateStore.set({
      entries,
      cursor,
      canUndo: cursor > 0,
      canRedo: cursor < entries.length,
      transaction: transaction?.label ?? null,
    });
  };

  const setDocument = (next: D) => {
    documentStore.set(next);
  };

  /**
   * Sets the document, then `record`s the step that changed it. A subscriber that throws (one that
   * tried to change the history from inside this change, say) is told so only once the step is
   * recorded, so the document and the history never disagree.
   */
  const setDocumentThen = (next: D, record: () => void) => {
    let failure: { readonly error: unknown } | undefined;
    try {
      setDocument(next);
    } catch (error) {
      failure = { error };
    }
    record();
    if (failure !== undefined) throw failure.error;
  };

  /** Whether a change to the history is in progress; see {@link exclusively}. */
  let busy = false;
  /**
   * Runs `work`, a change to the history, with nothing else changing it meanwhile: a recipe or a
   * subscriber that runs, undoes or jumps from inside it would record a step on top of a document
   * the change then overwrites (#238), so it throws {@link HistoryError} "reentrant" instead.
   */
  const exclusively = <T>(work: () => T): T => {
    if (busy) {
      throw new HistoryError(
        "reentrant",
        "Cannot change the history from inside a change to it (a recipe or a subscriber)",
      );
    }
    busy = true;
    try {
      return work();
    } finally {
      busy = false;
    }
  };

  const push = (entry: Omit<HistoryEntry<S>, "id">) => {
    entries = [...entries.slice(0, cursor), { id: `h${nextId++}`, ...entry }];
    if (entries.length > limit) {
      entries = entries.slice(entries.length - limit);
    }
    cursor = entries.length;
  };

  const assertNoTransaction = () => {
    if (transaction !== null) {
      throw new HistoryError(
        "transaction-open",
        `Cannot change the document while "${transaction.label}" is in progress`,
      );
    }
  };

  const run: HistoryManager<D, S>["run"] = (label, recipe, runOptions = {}) =>
    exclusively(() => {
      assertNoTransaction();
      const selectionBefore = selection.get();
      const [next, forward, inverse] = produce(documentStore.getState(), recipe);
      if (forward.length === 0) {
        return;
      }
      setDocumentThen(next, () => record(label, forward, inverse, selectionBefore, runOptions));
    });

  /** Records a run's step: a new entry, or merged into the current one while they coalesce. */
  const record = (
    label: string,
    forward: Patch[],
    inverse: Patch[],
    selectionBefore: S,
    runOptions: RunOptions<S>,
  ) => {
    const selectionAfter =
      "selectionAfter" in runOptions ? (runOptions.selectionAfter as S) : selection.get();
    const key = runOptions.coalesceKey ?? null;
    const timestamp = now();
    const current = entries[cursor - 1];
    const window = runOptions.coalesceWindowMs ?? defaultWindow;

    if (
      key !== null &&
      openChain === key &&
      current !== undefined &&
      cursor === entries.length &&
      timestamp - current.updatedAt <= window
    ) {
      entries = [
        ...entries.slice(0, cursor - 1),
        {
          ...current,
          label,
          forward: compactPatches([...current.forward, ...forward]),
          inverse: compactPatches([...inverse, ...current.inverse]),
          selectionAfter,
          updatedAt: timestamp,
        },
      ];
    } else {
      push({
        label,
        forward,
        inverse,
        coalesceKey: key,
        selectionBefore,
        selectionAfter,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    openChain = key;
    publish();
  };

  const begin: HistoryManager<D, S>["begin"] = (label) =>
    exclusively(() => {
      assertNoTransaction();
      const handle = { label };
      transaction = handle;
      openChain = null;
      const base = documentStore.getState();
      const selectionBefore = selection.get();
      const forward: Patch[] = [];
      let inverse: Patch[] = [];
      publish();

      const assertActive = () => {
        if (transaction !== handle) {
          throw new HistoryError(
            "transaction-closed",
            `"${label}" was already committed or cancelled`,
          );
        }
      };
      const close = () => {
        transaction = null;
      };

      return {
        get active() {
          return transaction === handle;
        },
        update(recipe) {
          exclusively(() => {
            assertActive();
            const [next, f, i] = produce(documentStore.getState(), recipe);
            setDocumentThen(next, () => {
              forward.push(...f);
              inverse = [...i, ...inverse];
            });
          });
        },
        commit(commitOptions = {}) {
          exclusively(() => {
            assertActive();
            close();
            if (forward.length > 0) {
              const timestamp = now();
              push({
                label: commitOptions.label ?? label,
                forward: compactPatches(forward),
                inverse: compactPatches(inverse),
                coalesceKey: null,
                selectionBefore,
                selectionAfter:
                  "selectionAfter" in commitOptions
                    ? (commitOptions.selectionAfter as S)
                    : selection.get(),
                createdAt: timestamp,
                updatedAt: timestamp,
              });
            }
            publish();
          });
        },
        cancel() {
          exclusively(() => {
            assertActive();
            close();
            // Nothing else can change the document while the transaction is open, so `base` is
            // exactly the state to return to.
            setDocumentThen(base, () => {
              selection.restore(selectionBefore);
              publish();
            });
          });
        },
      };
    });

  /** Moves the cursor to `target`, applying patches on the way, and restores selection once. */
  const moveTo = (target: number) => {
    let doc = documentStore.getState();
    let restore: S | undefined;
    let hasRestore = false;
    while (cursor > target) {
      const entry = entries[cursor - 1] as HistoryEntry<S>;
      doc = applyPatches(doc, entry.inverse);
      restore = entry.selectionBefore;
      hasRestore = true;
      cursor--;
    }
    while (cursor < target) {
      const entry = entries[cursor] as HistoryEntry<S>;
      doc = applyPatches(doc, entry.forward);
      restore = entry.selectionAfter;
      hasRestore = true;
      cursor++;
    }
    openChain = null;
    setDocumentThen(doc, () => {
      if (hasRestore) {
        selection.restore(restore as S);
      }
      publish();
    });
  };

  const undo = () =>
    exclusively(() => {
      if (transaction !== null || cursor === 0) {
        return false;
      }
      moveTo(cursor - 1);
      return true;
    });

  const redo = () =>
    exclusively(() => {
      if (transaction !== null || cursor === entries.length) {
        return false;
      }
      moveTo(cursor + 1);
      return true;
    });

  const jumpTo = (entryId: string | null) =>
    exclusively(() => {
      if (transaction !== null) {
        return false;
      }
      const target = entryId === null ? 0 : entries.findIndex((entry) => entry.id === entryId) + 1;
      if (target === 0 && entryId !== null) {
        return false;
      }
      moveTo(target);
      return true;
    });

  const endSession = (coalesceKey: string) => exclusively(() => endSessionNow(coalesceKey));

  const endSessionNow = (coalesceKey: string) => {
    let start = cursor;
    while (start > 0 && entries[start - 1]?.coalesceKey === coalesceKey) {
      start--;
    }
    if (openChain === coalesceKey) {
      openChain = null;
    }
    const later = entries.slice(cursor);
    if (start === cursor && !later.some((entry) => entry.coalesceKey === coalesceKey)) {
      return;
    }
    // The session's entries (including chunks undone during it) lose their key, so a later
    // session of the same field never merges into this one.
    const close = (entry: HistoryEntry<S>): HistoryEntry<S> =>
      entry.coalesceKey === coalesceKey ? { ...entry, coalesceKey: null } : entry;
    const session = entries.slice(start, cursor);
    const first = session[0];
    const last = session.at(-1);
    const merged: HistoryEntry<S>[] =
      first === undefined || last === undefined
        ? []
        : [
            {
              ...first,
              label: last.label,
              forward: compactPatches(session.flatMap((entry) => entry.forward)),
              inverse: compactPatches(session.toReversed().flatMap((entry) => entry.inverse)),
              coalesceKey: null,
              selectionAfter: last.selectionAfter,
              updatedAt: last.updatedAt,
            },
          ];
    entries = [...entries.slice(0, start), ...merged, ...later.map(close)];
    cursor = start + merged.length;
    publish();
  };

  return {
    document: documentStore.store,
    state: stateStore.store,
    run,
    begin,
    undo,
    redo,
    jumpTo,
    entries: () => entries,
    breakCoalescing: () => {
      openChain = null;
    },
    endSession,
    isChanging: () => busy,
    clear: () =>
      exclusively(() => {
        assertNoTransaction();
        entries = [];
        cursor = 0;
        openChain = null;
        publish();
      }),
  };
}
