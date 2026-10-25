import {
  type StoreImportOutcome,
  type StoreImportRequest,
  storageWriterAnswerSchema,
} from "../shared/storage-writer-protocol.js";

/** The parts of a `worker_threads` Worker the storage writer uses; a fake in tests. */
export type WriterThread = {
  postMessage(message: unknown, transfer?: readonly ArrayBuffer[]): void;
  on(event: "message", listener: (message: unknown) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "exit", listener: (code: number) => void): unknown;
  terminate(): Promise<number>;
};

/** Stores imports in the open site's file, off the main thread (R13b, ADR 0013). */
export type StorageWriter = {
  /** Reads, checks, hashes and stores one import; never throws (a failure is `failed`). */
  store(request: StoreImportRequest): Promise<StoreImportOutcome>;
  /**
   * Stops what the writer is doing, as closing the site does when it can wait no longer: the
   * thread ends, and an import it was writing fails. Its transaction is rolled back the next time
   * the file opens, and garbage collection removes a blob nothing names.
   */
  stop(): Promise<void>;
};

/**
 * The storage writer, in the thread `start` makes, started when the first import comes and again
 * after a stop or a crash. Answers are parsed, and a thread that ends fails what it was writing.
 */
export function createStorageWriter(start: () => WriterThread): StorageWriter {
  let thread: WriterThread | undefined;
  let nextId = 1;
  const pending = new Map<number, (outcome: StoreImportOutcome) => void>();

  const failAll = () => {
    for (const settle of pending.values()) settle({ status: "failed" });
    pending.clear();
  };

  const running = (): WriterThread => {
    if (thread !== undefined) return thread;
    const started = start();
    started.on("message", (message) => {
      const answer = storageWriterAnswerSchema.safeParse(message);
      if (!answer.success) return;
      pending.get(answer.data.id)?.(answer.data.outcome);
      pending.delete(answer.data.id);
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

  return {
    store(request) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        try {
          // Bytes move to the thread rather than being copied, when they have a buffer of their own.
          const data = "data" in request.source ? request.source.data : undefined;
          const ownBuffer =
            data !== undefined &&
            data.byteOffset === 0 &&
            data.byteLength === data.buffer.byteLength &&
            data.buffer instanceof ArrayBuffer;
          running().postMessage({ id, request }, ownBuffer ? [data.buffer as ArrayBuffer] : []);
        } catch {
          pending.delete(id);
          resolve({ status: "failed" });
        }
      });
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
 * A storage writer that runs on the calling thread, for tests and for the rare caller with no
 * thread to spare. Same results, but it holds up its thread while it stores.
 */
export function createInlineStorageWriter(
  storeImport: (request: StoreImportRequest) => Promise<StoreImportOutcome>,
): StorageWriter {
  return {
    store: (request) => storeImport(request).catch(() => ({ status: "failed" }) as const),
    stop: async () => undefined,
  };
}
