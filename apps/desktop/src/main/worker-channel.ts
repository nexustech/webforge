import type { z } from "zod";
import { workerCrashSchema } from "../shared/error-details.js";
import type { WorkerJob } from "../shared/export-worker-protocol.js";
import type { ExportProgress } from "../shared/ipc/site.js";
import { fromWorkerSchema, type ToWorker } from "../shared/worker-channel-protocol.js";
import type { WorkerProcess } from "./worker-process.js";

/** Why a job gave no outcome: the channel's own reasons, or the worker's (`invalid-job`, `unexpected`). */
type JobFailure =
  | "worker-start-failed"
  | "worker-unreachable"
  | "timeout"
  | "invalid-worker-message"
  | "invalid-job"
  | "unexpected"
  | "closed"
  | `worker-exit-${number}`;

/** What came of a job: its outcome, checked against the job's schema, or why there is none. */
type JobResult<O> =
  | { readonly ok: true; readonly outcome: O }
  | { readonly ok: false; readonly reason: JobFailure };

/** The bytes and type the open site stores under a hash, or none. */
export type ReadMedia = (
  hash: string,
) => Promise<{ readonly data: Uint8Array; readonly mime: string } | undefined>;

/** How one job runs: what its outcome must be, how long it may take, and what it may ask for. */
type JobOptions<O> = {
  /** The job's outcome; anything else fails it, and the worker is stopped. */
  readonly outcome: z.ZodType<O>;
  /** How long it may take before it fails and the worker is stopped (a stuck codec, say). */
  readonly timeoutMs: number;
  /** Cancels it: the worker is told, and the job ends with what the worker answers. */
  readonly signal?: AbortSignal | undefined;
  /** Told how far it has come (an export, 3.1). */
  readonly onProgress?: ((progress: ExportProgress) => void) | undefined;
  /** Reads the bytes it asks for, one at a time (R15); none are there without it. */
  readonly readMedia?: ReadMedia | undefined;
};

/** Jobs for one long-lived utility process; see {@link createWorkerChannel}. */
export type WorkerChannel = {
  /** Sends `job`, and resolves with its outcome or why it has none. Never rejects. */
  run<O>(job: WorkerJob, options: JobOptions<O>): Promise<JobResult<O>>;
  /** Stops the worker; the jobs under way end as `closed`. The next job starts a new one. */
  close(): void;
};

/** A job sent and not yet answered. */
type Pending = {
  readonly worker: WorkerProcess;
  readonly options: JobOptions<unknown>;
  finish(result: JobResult<unknown>): void;
};

/**
 * One way to the main process's utility processes (A14): the export's, the preview's, the canvas
 * styles' and the thumbnails'. The worker starts with the first job and again after it exits or is
 * stopped, so a job costs no process start while it runs. Each job gets an `id`, and what the
 * worker sends for it (its outcome, its progress, its reads of the site's bytes) is matched to it
 * by that id. Nothing the worker sends is trusted: an outcome its job's schema doesn't take, or a
 * message that isn't the channel's, fails the job and stops the worker, as do a timeout and an
 * exit, which fail the worker's other jobs too. A worker's crash report is left to the crash
 * handlers (R3).
 */
export function createWorkerChannel(startWorker: () => WorkerProcess): WorkerChannel {
  let worker: WorkerProcess | undefined;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  /** Fails every job sent to `stopped`. */
  const failAll = (stopped: WorkerProcess, reason: JobFailure) => {
    for (const job of [...pending.values()]) {
      if (job.worker === stopped) job.finish({ ok: false, reason });
    }
  };
  /** Stops `stopping`, failing its jobs as `reason`, so the next job starts a fresh worker. */
  const discard = (stopping: WorkerProcess, reason: JobFailure) => {
    if (worker === stopping) worker = undefined;
    failAll(stopping, reason);
    stopping.kill();
  };
  /** Sends `message`; a worker that can't take it any more is replaced. */
  const send = (to: WorkerProcess, message: ToWorker) => {
    try {
      to.postMessage(message);
      return true;
    } catch {
      discard(to, "worker-unreachable");
      return false;
    }
  };

  const listen = (started: WorkerProcess) => {
    started.on("message", (raw) => {
      if (workerCrashSchema.safeParse(raw).success) return;
      const message = fromWorkerSchema.safeParse(raw);
      const job = message.success ? pending.get(message.data.id) : undefined;
      if (!message.success || (job !== undefined && job.worker !== started)) {
        discard(started, "invalid-worker-message");
        return;
      }
      // Of a job that has ended (a timeout, a cancel answered): nothing is left to tell.
      if (job === undefined) return;
      const { data } = message;
      switch (data.message) {
        case "outcome": {
          const outcome = job.options.outcome.safeParse(data.outcome);
          if (outcome.success) job.finish({ ok: true, outcome: outcome.data });
          else discard(started, "invalid-worker-message");
          return;
        }
        case "failed":
          job.finish({ ok: false, reason: data.detail });
          return;
        case "progress":
          job.options.onProgress?.(data.progress);
          return;
        case "read-blob": {
          // A failed read is a missing file: the build leaves it out, with a warning.
          const read = job.options.readMedia?.(data.hash) ?? Promise.resolve(undefined);
          void read
            .catch(() => undefined)
            .then((blob) => {
              if (pending.get(data.id) !== job || worker !== started) return;
              // Only the bytes and their type: the worker's schema takes nothing else.
              send(started, {
                message: "blob",
                id: data.id,
                read: data.read,
                ...(blob === undefined ? {} : { blob: { data: blob.data, mime: blob.mime } }),
              });
            });
        }
      }
    });
    started.on("exit", (code) => {
      if (worker === started) worker = undefined;
      failAll(started, `worker-exit-${code}`);
    });
  };

  /** The worker, started with its listeners on first use. */
  const ready = (): WorkerProcess => {
    if (worker !== undefined) return worker;
    const started = startWorker();
    worker = started;
    listen(started);
    return started;
  };

  return {
    run<O>(job: WorkerJob, options: JobOptions<O>): Promise<JobResult<O>> {
      return new Promise((resolve) => {
        let target: WorkerProcess;
        try {
          target = ready();
        } catch {
          // The worker couldn't start: this job fails, and the next one tries again.
          resolve({ ok: false, reason: "worker-start-failed" });
          return;
        }
        const id = nextId++;
        const cancel = () => {
          send(target, { message: "cancel", id });
        };
        const timer = setTimeout(() => {
          finish({ ok: false, reason: "timeout" });
          discard(target, "timeout");
        }, options.timeoutMs);
        const finish = (result: JobResult<unknown>) => {
          if (pending.get(id)?.finish !== finish) return;
          pending.delete(id);
          clearTimeout(timer);
          options.signal?.removeEventListener("abort", cancel);
          resolve(result as JobResult<O>);
        };
        pending.set(id, { worker: target, options, finish });
        if (!send(target, { message: "job", id, job })) return;
        if (options.signal?.aborted === true) cancel();
        else options.signal?.addEventListener("abort", cancel, { once: true });
      });
    },
    close() {
      if (worker !== undefined) discard(worker, "closed");
    },
  };
}
