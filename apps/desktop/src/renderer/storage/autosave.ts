import type { ReadonlyStore } from "@webforge/history";
import { changedDocuments, type SiteDoc, type SiteDocumentChange } from "@webforge/model";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { CommitResult } from "../../shared/ipc-contract.js";
import { reportFailure } from "../log.js";

/**
 * What the title bar shows (P2): `saved` once every change is in the file, `unsaved` while a save
 * is due, `saving` during one, `error` when the last save failed (the next change or Ctrl/Cmd+S
 * tries again).
 */
export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

/** Timers, injectable so tests can use fake ones. */
type Timers = {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

/** Options of {@link createAutosave}. */
export type AutosaveOptions = {
  /** The history's document store; autosave only reads it, so undo is never affected. */
  readonly document: ReadonlyStore<SiteDoc>;
  /**
   * The site as the file holds it, or `undefined` for a new, empty site: then the first save
   * writes every document.
   */
  readonly saved: SiteDoc | undefined;
  /** Saves changed documents (`window.webforge.project.commit`). */
  readonly commit: (changes: readonly SiteDocumentChange[]) => Promise<CommitResult>;
  /** Pause after the last change before saving (P2: about 2 s). */
  readonly idleMs?: number;
  /** Longest time a change waits while editing continues (P2: 30 s). */
  readonly maxWaitMs?: number;
  readonly timers?: Timers;
};

/** A running autosave for one open site. */
export type Autosave = {
  readonly status: StoreApi<{ readonly status: SaveStatus }>;
  /** Saves now (blur, page switch, close, Ctrl/Cmd+S); resolves once the file has every change. */
  flush(): Promise<void>;
  /** Stops listening and cancels pending saves; does not save. */
  dispose(): void;
};

const IDLE_MS = 2_000;
const MAX_WAIT_MS = 30_000;

/**
 * Saves the site periodically (P2, F-SITE-3): about 2 s after editing pauses, and at least every
 * 30 s while it continues. Only documents whose objects changed are written: the history keeps
 * unchanged parts of the tree as the same objects, so the diff is found by reference
 * (`changedDocuments`). Saving never touches the history, so undo is unaffected.
 */
export function createAutosave(options: AutosaveOptions): Autosave {
  const timers: Timers = options.timers ?? {
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  const idleMs = options.idleMs ?? IDLE_MS;
  const maxWaitMs = options.maxWaitMs ?? MAX_WAIT_MS;
  let saved = options.saved;
  const initialStatus: SaveStatus = saved === options.document.getState() ? "saved" : "unsaved";
  const status = createStore<{ status: SaveStatus }>()(() => ({ status: initialStatus }));
  let idleTimer: unknown;
  let maxTimer: unknown;
  /** The save in progress; saves run one after another so they never race in the file. */
  let running: Promise<void> | undefined;
  let disposed = false;

  const clearTimers = () => {
    if (idleTimer !== undefined) timers.clearTimeout(idleTimer);
    if (maxTimer !== undefined) timers.clearTimeout(maxTimer);
    idleTimer = undefined;
    maxTimer = undefined;
  };

  const schedule = () => {
    if (idleTimer !== undefined) timers.clearTimeout(idleTimer);
    idleTimer = timers.setTimeout(() => void flush(), idleMs);
    maxTimer ??= timers.setTimeout(() => void flush(), maxWaitMs);
  };

  async function saveOnce(): Promise<void> {
    clearTimers();
    const next = options.document.getState();
    const changes = changedDocuments(saved, next);
    if (changes.length === 0) {
      saved = next;
      status.setState({ status: "saved" });
      return;
    }
    status.setState({ status: "saving" });
    let result: CommitResult;
    try {
      result = await options.commit(changes);
    } catch (error) {
      reportFailure("autosave.commit", error);
      result = { status: "failed", reason: "unknown" };
    }
    if (disposed) {
      return;
    }
    if (result.status === "failed" && result.reason === "stale-session") {
      // Another site has replaced this one in the window (a hand-off, R6): what was still to save
      // belongs to a site no longer open, so it is dropped, and the window reloads with the new one.
      disposed = true;
      clearTimers();
      unsubscribe();
      return;
    }
    if (result.status === "saved") {
      saved = next;
    }
    if (options.document.getState() !== next) {
      // Edited while saving: those changes get their own save.
      status.setState({ status: result.status === "saved" ? "unsaved" : "error" });
      schedule();
    } else {
      status.setState({ status: result.status === "saved" ? "saved" : "error" });
    }
  }

  async function flush(): Promise<void> {
    if (disposed) {
      return;
    }
    // Wait for a save in progress, then save what changed since it started.
    while (running !== undefined) {
      await running;
    }
    if (saved === options.document.getState() && status.getState().status === "saved") {
      clearTimers();
      return;
    }
    running = saveOnce().finally(() => {
      running = undefined;
    });
    await running;
  }

  const unsubscribe = options.document.subscribe((next) => {
    if (next !== saved) {
      if (status.getState().status !== "saving") {
        status.setState({ status: status.getState().status === "error" ? "error" : "unsaved" });
      }
      schedule();
    }
  });
  if (initialStatus === "unsaved") {
    // A new site: write its first documents straight away.
    void flush();
  }

  return {
    status,
    flush,
    dispose() {
      disposed = true;
      clearTimers();
      unsubscribe();
    },
  };
}
