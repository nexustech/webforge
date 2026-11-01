import type { z } from "zod";
import type { WorkerJob } from "../shared/export-worker-protocol.js";
import { createWorkerChannel } from "./worker-channel.js";
import type { WorkerProcess } from "./worker-process.js";

/**
 * Sends jobs to one long-lived utility process through a {@link createWorkerChannel}, so a job
 * costs no process start (the canvas CSS of 1.12, the Media thumbnails of 1.16). Each answer is
 * validated with `outcomeSchema`. A job resolves `null` on a timeout (the stuck worker is stopped
 * and replaced on the next job), when its worker exits, or when no valid answer comes: nothing
 * unexpected is trusted. Jobs are typed from the worker's own schema (`J`, some of
 * `workerJobSchema`), so one the worker doesn't take fails to compile.
 */
export function createWorkerRequests<O, J extends WorkerJob>(
  startWorker: () => WorkerProcess,
  outcomeSchema: z.ZodType<O>,
  timeoutMs: number,
): (job: J) => Promise<O | null> {
  const channel = createWorkerChannel(startWorker);
  return async (job) => {
    const result = await channel.run(job, { outcome: outcomeSchema, timeoutMs });
    return result.ok ? result.outcome : null;
  };
}
