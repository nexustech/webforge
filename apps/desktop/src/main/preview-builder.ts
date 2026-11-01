import {
  type PreviewJob,
  type PreviewOutcome,
  previewOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import { createWorkerChannel, type ReadMedia } from "./worker-channel.js";
import type { WorkerProcess } from "./worker-process.js";

/** How long a preview build may take before the worker is stopped: its first encodes every image. */
const PREVIEW_TIMEOUT_MS = 10 * 60_000;

/** What the preview builder reads and tells; see {@link createPreviewBuilder}. */
export type PreviewBuilderOptions = {
  /** The bytes and type the open site stores under a hash, as the worker asks for them (R15). */
  readonly readMedia: ReadMedia;
  /** Told each build's validated outcome, in the order they finish. */
  readonly onBuilt: (outcome: PreviewOutcome) => void;
  readonly timeoutMs?: number;
};

/** Builds the open site for the preview server in a worker of its own (3.2). */
export type PreviewBuilder = {
  /**
   * Builds `job` once the build under way is done. A job still waiting is replaced: an edit made
   * while a build runs is built once, with every edit before it, never one by one.
   */
  request(job: PreviewJob): void;
  /** Stops the worker, and what it kept in memory goes with it: the site or its preview closed. */
  close(): void;
};

/**
 * Builds previews in a utility process kept while the preview is open, so its pipeline keeps the
 * pages it rendered, the images it encoded and its stylesheet for the next build (3.1), and its
 * last build's files, to answer with only what changed. One build at a time, through a
 * {@link createWorkerChannel}, the latest waiting job next. A worker that exits, answers with
 * anything unexpected or takes too long fails that build and is replaced for the next, which then
 * answers with every file (`full`).
 */
export function createPreviewBuilder(
  startWorker: () => WorkerProcess,
  options: PreviewBuilderOptions,
): PreviewBuilder {
  const timeoutMs = options.timeoutMs ?? PREVIEW_TIMEOUT_MS;
  const channel = createWorkerChannel(startWorker);
  let building = false;
  let waiting: PreviewJob | undefined;
  let closed = false;

  const next = () => {
    if (closed || building || waiting === undefined) return;
    const job = waiting;
    waiting = undefined;
    building = true;
    void channel
      .run(job, { outcome: previewOutcomeSchema, timeoutMs, readMedia: options.readMedia })
      .then((result) => {
        building = false;
        if (closed) return;
        options.onBuilt(
          result.ok ? result.outcome : { type: "preview-failed", detail: result.reason },
        );
        next();
      });
  };

  return {
    request(job) {
      if (closed) return;
      waiting = job;
      next();
    },
    close() {
      closed = true;
      waiting = undefined;
      channel.close();
    },
  };
}
