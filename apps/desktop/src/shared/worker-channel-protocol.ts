import { z } from "zod";
import { bytesSchema } from "./export-worker-protocol.js";
import { publishProgressSchema } from "./ipc/publish.js";
import { exportProgressSchema } from "./ipc/site.js";

/** How far a job has come: an export's (3.1) or a publish's (4.5). */
const jobProgressSchema = z.union([exportProgressSchema, publishProgressSchema]);

/** How far a job has come. */
export type JobProgress = z.infer<typeof jobProgressSchema>;

/**
 * The envelope every message between the main process and a utility process travels in (A14): a
 * job and what belongs to it carry the job's `id`, given by the main process's channel
 * (`main/worker-channel.ts`) and echoed by the worker's dispatch (`worker/job-dispatch.ts`). The
 * job itself and its outcome are each checked against their own schemas, inside.
 */
const idSchema = z.int().nonnegative();

/** What the main process sends a worker. */
export const toWorkerSchema = z.discriminatedUnion("message", [
  /** A job to run (`workerJobSchema`, which the worker checks). */
  z.strictObject({ message: z.literal("job"), id: idSchema, job: z.unknown() }),
  /** Stops job `id` before its next image or page; it writes nothing (an export, R15). */
  z.strictObject({ message: z.literal("cancel"), id: idSchema }),
  /** The bytes job `id` asked for with `read`, or none when the site doesn't store them. */
  z.strictObject({
    message: z.literal("blob"),
    id: idSchema,
    read: idSchema,
    blob: z.strictObject({ data: bytesSchema, mime: z.string().max(255) }).optional(),
  }),
]);

/** What the main process sends a worker. */
export type ToWorker = z.infer<typeof toWorkerSchema>;

/** What a worker sends the main process. */
export const fromWorkerSchema = z.discriminatedUnion("message", [
  /** Job `id`'s outcome, which the job's own schema checks in the main process. */
  z.strictObject({ message: z.literal("outcome"), id: idSchema, outcome: z.unknown() }),
  /** Job `id` couldn't run: a job the worker doesn't take, or an error its handler didn't catch. */
  z.strictObject({
    message: z.literal("failed"),
    id: idSchema,
    detail: z.enum(["invalid-job", "unexpected"]),
  }),
  /** How far job `id` has come (an export, 3.1; a publish, 4.5). */
  z.strictObject({ message: z.literal("progress"), id: idSchema, progress: jobProgressSchema }),
  /** Job `id` asks, as `read`, for the bytes the site stores under `hash` (R15). */
  z.strictObject({
    message: z.literal("read-blob"),
    id: idSchema,
    read: idSchema,
    hash: z.string().regex(/^[0-9a-f]{64}$/),
  }),
]);

/** What a worker sends the main process. */
export type FromWorker = z.infer<typeof fromWorkerSchema>;
