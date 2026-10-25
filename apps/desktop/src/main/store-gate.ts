/**
 * Who may use the open site's file (R13b). The main process reads and commits through its own
 * connection; the storage writer (a worker thread) writes large blobs through another. Under
 * SQLite's rollback journal a writer locks out every other connection while it commits, and a
 * connection that met that lock would wait on the main thread, so the two take turns here instead:
 *
 * - `shared` work (reads, commits, backups: anything on the main process's side) runs alongside
 *   other shared work;
 * - `exclusive` work (the writer, and closing the site) runs alone.
 *
 * Work runs in the order it asked, so a commit asked for while an import writes lands after it,
 * and in order with the commits around it. Shared work asked for while exclusive work waits queues
 * behind it, so a writer is never starved.
 */

export type GateKind = "shared" | "exclusive";

/** Options of {@link StoreGate.run}. */
type GateRunOptions = {
  /**
   * How long to wait for the gate before running anyway, for closing the site: a writer that
   * doesn't finish can't hold up quitting. Without it, work waits as long as it takes.
   */
  readonly waitMs?: number;
};

/** Timers, injectable so tests can use fake ones. */
export type GateTimers = {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type StoreGate = {
  /** Runs `work` when the gate lets work of `kind` in, and gives its result. */
  run<T>(kind: GateKind, work: () => T | Promise<T>, options?: GateRunOptions): Promise<T>;
  /** Whether any work holds the gate now: what the store asserts in tests. */
  held(): boolean;
};

type Waiter = { readonly kind: GateKind; readonly admit: () => void };

const defaultTimers: GateTimers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** A gate with nothing waiting. */
export function createStoreGate(timers: GateTimers = defaultTimers): StoreGate {
  let shared = 0;
  let exclusive = 0;
  const queue: Waiter[] = [];

  const fits = (kind: GateKind) => exclusive === 0 && (kind === "shared" || shared === 0);

  /** Lets in the waiting work at the front of the queue that fits, in order. */
  const admitNext = () => {
    for (let next = queue[0]; next !== undefined && fits(next.kind); next = queue[0]) {
      queue.shift();
      next.admit();
    }
  };

  /** Waits for a place for `kind` (or until `waitMs`), then holds it; gives what releases it. */
  const enter = (kind: GateKind, waitMs: number | undefined) =>
    new Promise<() => void>((resolve) => {
      let done = false;
      const hold = () => {
        if (done) return;
        done = true;
        if (kind === "shared") shared += 1;
        else exclusive += 1;
        resolve(() => {
          if (kind === "shared") shared -= 1;
          else exclusive -= 1;
          admitNext();
        });
      };
      if (queue.length === 0 && fits(kind)) {
        hold();
        return;
      }
      const waiter: Waiter = {
        kind,
        admit: () => {
          if (timer !== undefined) timers.clearTimeout(timer);
          hold();
        },
      };
      queue.push(waiter);
      const timer =
        waitMs === undefined
          ? undefined
          : timers.setTimeout(() => {
              const index = queue.indexOf(waiter);
              if (index >= 0) queue.splice(index, 1);
              hold();
              // The work behind it may fit now, or wait for it.
              admitNext();
            }, waitMs);
    });

  return {
    async run(kind, work, options = {}) {
      const release = await enter(kind, options.waitMs);
      try {
        return await work();
      } finally {
        release();
      }
    },
    held: () => shared > 0 || exclusive > 0,
  };
}
