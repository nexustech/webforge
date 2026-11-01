import type { StoredMedia } from "@webforge/pipeline";
import { type WorkerJob, workerJobSchema } from "../shared/export-worker-protocol.js";
import type { JobProgress } from "../shared/worker-channel-protocol.js";
import { type FromWorker, toWorkerSchema } from "../shared/worker-channel-protocol.js";

/** What a job's handler gets besides the job: the site's bytes, its cancel, its progress. */
export type JobContext = {
  /** The bytes the open site stores under a hash, asked of the main process one at a time (R15). */
  readonly readMedia: (hash: string) => Promise<StoredMedia | undefined>;
  /** Aborted when the main process cancels this job, and only this one. */
  readonly signal: AbortSignal;
  /** Tells the main process how far the job has come (an export, 3.1). */
  readonly onProgress: (progress: JobProgress) => void;
};

/** A handler for each kind of job the worker takes: its outcome, as its job's schema has it. */
export type JobHandlers = {
  readonly [T in WorkerJob["type"]]: (
    job: Extract<WorkerJob, { type: T }>,
    context: JobContext,
  ) => unknown;
};

/**
 * The worker's side of the channel (A14): each message from the main process goes to the job it
 * names, each job to its kind's handler, and everything the job sends back carries its `id`, its
 * outcome or why it has none included. A message that isn't the channel's, or a job the worker
 * doesn't take, is answered as `invalid-job` where it names one, and otherwise left: the main
 * process's channel trusts nothing it didn't ask for either.
 */
export function createJobDispatch(
  handlers: JobHandlers,
  post: (message: FromWorker) => void,
): (raw: unknown) => void {
  const cancels = new Map<number, AbortController>();
  const reads = new Map<number, (blob: StoredMedia | undefined) => void>();
  let nextRead = 0;

  const run = async (id: number, raw: unknown) => {
    const job = workerJobSchema.safeParse(raw);
    if (!job.success) {
      post({ message: "failed", id, detail: "invalid-job" });
      return;
    }
    const cancelled = new AbortController();
    cancels.set(id, cancelled);
    const context: JobContext = {
      readMedia: (hash) =>
        new Promise((resolve) => {
          const read = nextRead++;
          reads.set(read, resolve);
          post({ message: "read-blob", id, read, hash });
        }),
      signal: cancelled.signal,
      onProgress: (progress) => post({ message: "progress", id, progress }),
    };
    try {
      const handle = handlers[job.data.type] as (each: WorkerJob, context: JobContext) => unknown;
      post({ message: "outcome", id, outcome: await handle(job.data, context) });
    } catch {
      post({ message: "failed", id, detail: "unexpected" });
    } finally {
      cancels.delete(id);
    }
  };

  return (raw) => {
    const message = toWorkerSchema.safeParse(raw);
    if (!message.success) return;
    const { data } = message;
    switch (data.message) {
      case "job":
        void run(data.id, data.job);
        return;
      case "cancel":
        cancels.get(data.id)?.abort();
        return;
      case "blob":
        reads.get(data.read)?.(data.blob);
        reads.delete(data.read);
    }
  };
}
