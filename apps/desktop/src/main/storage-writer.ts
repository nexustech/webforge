import {
  type ImportSource,
  type PrepareOutcome,
  type StorageWriterMessage,
  type StoreOutcome,
  storageWriterAnswerSchema,
} from "../shared/storage-writer-protocol.js";
import type { ImportJobs } from "../worker/store-import.js";

/** The parts of a `worker_threads` Worker the storage writer uses; a fake in tests. */
export type WriterThread = {
  postMessage(message: unknown, transfer?: readonly ArrayBuffer[]): void;
  on(event: "message", listener: (message: unknown) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "exit", listener: (code: number) => void): unknown;
  terminate(): Promise<number>;
};

/** An import the writer has read, checked and hashed, ready to store. */
export type PreparedImport = Extract<PrepareOutcome, { status: "prepared" }> & {
  /** Which prepared bytes the writer keeps for it. */
  readonly token: number;
};

/** Where a prepared import goes: the open site's file, as a Media item's asset. */
type ImportTarget = {
  readonly sitePath: string;
  readonly mediaId: string;
  readonly originalName: string;
};

/** Stores imports in the open site's file, off the main thread (R13b, ADR 0013). */
export type StorageWriter = {
  /**
   * Starts the thread now, if it isn't running, so the first import doesn't wait for it: starting
   * a thread takes the main thread a few milliseconds. When a site opens, which is idle time.
   */
  warm(): void;
  /**
   * Reads, checks and hashes a file, keeping its bytes for {@link store}: no gate needed, as it
   * doesn't touch the site's file. Never throws (a failure is `failed`).
   */
  prepare(
    fileName: string,
    source: ImportSource,
  ): Promise<PreparedImport | Exclude<PrepareOutcome, { status: "prepared" }>>;
  /** Stores a prepared import, while its caller holds the store gate alone. Never throws. */
  store(prepared: PreparedImport, target: ImportTarget): Promise<StoreOutcome>;
  /** Forgets a prepared import that goes no further, such as one for a site that has closed. */
  discard(prepared: PreparedImport): void;
  /**
   * Stops what the writer is doing, as closing the site does when it can wait no longer: the
   * thread ends, and an import it was storing fails. Its transaction is rolled back the next time
   * the file opens.
   */
  stop(): Promise<void>;
};

/** The id a message from the thread carries, if it carries one. */
function idOf(message: unknown): number | undefined {
  if (typeof message !== "object" || message === null || !("id" in message)) return undefined;
  return typeof message.id === "number" ? message.id : undefined;
}

/** Bytes that can move to the thread rather than be copied: those with a buffer of their own. */
function transferable(source: ImportSource): ArrayBuffer[] {
  if (!("data" in source)) return [];
  const { data } = source;
  return data.byteOffset === 0 &&
    data.byteLength === data.buffer.byteLength &&
    data.buffer instanceof ArrayBuffer
    ? [data.buffer]
    : [];
}

type Outcome = PrepareOutcome | StoreOutcome;

/**
 * The storage writer, in the thread `start` makes, started when the first import comes (or
 * {@link StorageWriter.warm}) and again after a stop or a crash. Answers are parsed; a thread that
 * ends fails what it was doing, and an answer that doesn't parse fails its step.
 */
export function createStorageWriter(start: () => WriterThread): StorageWriter {
  let thread: WriterThread | undefined;
  let nextId = 1;
  const pending = new Map<number, (outcome: Outcome) => void>();

  const failAll = () => {
    for (const settle of pending.values()) settle({ status: "failed" });
    pending.clear();
  };

  const running = (): WriterThread => {
    if (thread !== undefined) return thread;
    const started = start();
    started.on("message", (message) => {
      const answer = storageWriterAnswerSchema.safeParse(message);
      // An answer that doesn't parse still settles its step, as failed: an import left waiting
      // in its store step would hold the store gate, and every save behind it, for good.
      const id = answer.success ? answer.data.id : idOf(message);
      const settle = id === undefined ? undefined : pending.get(id);
      if (id === undefined || settle === undefined) return;
      pending.delete(id);
      settle(answer.success ? answer.data.outcome : { status: "failed" });
    });
    const ended = () => {
      if (thread === started) thread = undefined;
      failAll();
    };
    started.on("error", ended);
    started.on("exit", ended);
    thread = started;
    return started;
  };

  /** Sends `message` with a new id and gives the thread's answer, or `failed`. */
  const ask = (
    message: (id: number) => StorageWriterMessage,
    transfer: ArrayBuffer[] = [],
  ): Promise<Outcome> => {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      try {
        running().postMessage(message(id), transfer);
      } catch {
        pending.delete(id);
        resolve({ status: "failed" });
      }
    });
  };

  return {
    warm() {
      try {
        running();
      } catch {
        // It starts again with the first import, which then fails if it still can't.
      }
    },
    async prepare(fileName, source) {
      let token = 0;
      const outcome = await ask((id) => {
        token = id;
        return { id, type: "prepare", fileName, source };
      }, transferable(source));
      // A store's answer to a prepare is no answer at all.
      if (outcome.status === "stored") return { status: "failed" };
      return outcome.status === "prepared" ? { ...outcome, token } : outcome;
    },
    async store(prepared, target) {
      const outcome = await ask((id) => ({
        id,
        type: "store",
        prepared: prepared.token,
        ...target,
      }));
      return outcome.status === "stored" ? outcome : { status: "failed" };
    },
    discard(prepared) {
      try {
        thread?.postMessage({ id: nextId++, type: "discard", prepared: prepared.token });
      } catch {
        // A thread that has ended has forgotten it anyway.
      }
    },
    async stop() {
      const current = thread;
      thread = undefined;
      failAll();
      await current?.terminate();
    },
  };
}

/**
 * A storage writer that runs on the calling thread, for tests. Same results, but it holds up its
 * thread while it reads and stores.
 */
export function createInlineStorageWriter(jobs: ImportJobs): StorageWriter {
  let nextToken = 1;
  return {
    warm: () => undefined,
    async prepare(fileName, source) {
      const token = nextToken++;
      const outcome = await jobs.prepare(token, fileName, source).catch(() => undefined);
      if (outcome === undefined) return { status: "failed" };
      return outcome.status === "prepared" ? { ...outcome, token } : outcome;
    },
    store: async (prepared, target) => jobs.store(prepared.token, target),
    discard: (prepared) => jobs.discard(prepared.token),
    stop: async () => undefined,
  };
}
