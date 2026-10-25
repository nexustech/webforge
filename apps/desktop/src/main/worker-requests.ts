import type { z } from "zod";
import type { WorkerJob } from "../shared/export-worker-protocol.js";
import type { WorkerProcess } from "./worker-process.js";

/** `T` without `K`, member by member of a union: a job before its `id` is added. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Sends jobs to one long-lived utility process, started on first use and again after it exits, so
 * a job costs no process start (the canvas CSS of 1.12, the Media thumbnails of 1.16). Each job gets
 * an `id`; answers are matched to it and validated with `outcomeSchema`. A job resolves `null` on
 * a timeout (the stuck worker is stopped and replaced on the next job), when its worker exits, or
 * when no valid answer comes: nothing unexpected is trusted. Jobs are typed from the worker's own
 * schema (`J`, some of `workerJobSchema`), so one the worker doesn't take fails to compile.
 */
export function createWorkerRequests<O extends { readonly id: number }, J extends WorkerJob>(
  startWorker: () => WorkerProcess,
  outcomeSchema: z.ZodType<O>,
  timeoutMs: number,
): (job: DistributiveOmit<J, "id">) => Promise<O | null> {
  let worker: WorkerProcess | null = null;
  let nextId = 0;
  /** Jobs waiting for an answer, with the worker each was sent to. */
  const pending = new Map<
    number,
    { readonly worker: WorkerProcess; finish(outcome: O | null): void }
  >();

  const running = (): WorkerProcess => {
    if (worker !== null) {
      return worker;
    }
    const started = startWorker();
    started.on("message", (message) => {
      const outcome = outcomeSchema.safeParse(message);
      const request = outcome.success ? pending.get(outcome.data.id) : undefined;
      if (outcome.success && request?.worker === started) {
        request.finish(outcome.data);
      }
    });
    started.on("exit", () => {
      if (worker === started) {
        worker = null;
      }
      // Only its own jobs: a newer worker may already be answering others.
      for (const request of [...pending.values()]) {
        if (request.worker === started) request.finish(null);
      }
    });
    worker = started;
    return started;
  };

  return (job) =>
    new Promise((resolve) => {
      const id = nextId++;
      const target = running();
      const finish = (outcome: O | null) => {
        clearTimeout(timer);
        pending.delete(id);
        resolve(outcome);
      };
      const timer = setTimeout(() => {
        finish(null);
        // A stuck worker is replaced on the next job.
        if (worker === target) worker = null;
        target.kill();
      }, timeoutMs);
      pending.set(id, { worker: target, finish });
      target.postMessage({ ...job, id });
    });
}
