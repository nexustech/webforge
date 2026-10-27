import {
  blobRequestSchema,
  type ExportMessage,
  type PreviewJob,
  type PreviewOutcome,
  previewOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import type { WorkerProcess } from "./worker-process.js";

/** How long a preview build may take before the worker is stopped: its first encodes every image. */
const PREVIEW_TIMEOUT_MS = 10 * 60_000;

/** What the preview builder reads and tells; see {@link createPreviewBuilder}. */
export type PreviewBuilderOptions = {
  /** The bytes and type the open site stores under a hash, as the worker asks for them (R15). */
  readonly readMedia: (
    hash: string,
  ) => Promise<{ readonly data: Uint8Array; readonly mime: string } | undefined>;
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
 * last build's files, to answer with only what changed. One build at a time, the latest waiting
 * job next. A worker that exits, answers with anything unexpected or takes too long fails that
 * build and is replaced for the next, which then answers with every file (`full`).
 */
export function createPreviewBuilder(
  startWorker: () => WorkerProcess,
  options: PreviewBuilderOptions,
): PreviewBuilder {
  const timeoutMs = options.timeoutMs ?? PREVIEW_TIMEOUT_MS;
  let worker: WorkerProcess | undefined;
  let building:
    | { readonly finish: (outcome: PreviewOutcome) => void; readonly timer: NodeJS.Timeout }
    | undefined;
  let waiting: PreviewJob | undefined;
  let closed = false;

  const discard = (stopping: WorkerProcess) => {
    if (worker === stopping) worker = undefined;
    stopping.kill();
  };

  const ready = (): WorkerProcess => {
    if (worker !== undefined) return worker;
    const started = startWorker();
    worker = started;
    started.on("message", (message) => {
      if (worker !== started) return;
      const request = blobRequestSchema.safeParse(message);
      if (request.success) {
        const { id, hash } = request.data;
        // A failed read is a missing file: the build leaves it out, as an export does.
        void options
          .readMedia(hash)
          .catch(() => undefined)
          .then((blob) => {
            if (worker !== started) return;
            started.postMessage(
              (blob === undefined
                ? { type: "blob", id }
                : {
                    type: "blob",
                    id,
                    blob: { data: blob.data, mime: blob.mime },
                  }) satisfies ExportMessage,
            );
          });
        return;
      }
      const outcome = previewOutcomeSchema.safeParse(message);
      if (outcome.success) {
        building?.finish(outcome.data);
      } else {
        building?.finish({ type: "preview-failed", detail: "invalid-worker-message" });
        discard(started);
      }
    });
    started.on("exit", (code) => {
      if (worker === started) worker = undefined;
      building?.finish({ type: "preview-failed", detail: `worker-exit-${code}` });
    });
    return started;
  };

  const next = () => {
    if (closed || building !== undefined || waiting === undefined) return;
    const job = waiting;
    waiting = undefined;
    let current: WorkerProcess;
    try {
      current = ready();
    } catch {
      options.onBuilt({ type: "preview-failed", detail: "worker-start-failed" });
      next();
      return;
    }
    const timer = setTimeout(() => {
      finish({ type: "preview-failed", detail: "timeout" });
      discard(current);
    }, timeoutMs);
    const finish = (outcome: PreviewOutcome) => {
      if (building?.finish !== finish) return;
      building = undefined;
      clearTimeout(timer);
      if (!closed) options.onBuilt(outcome);
      next();
    };
    building = { finish, timer };
    try {
      current.postMessage(job);
    } catch {
      finish({ type: "preview-failed", detail: "worker-unreachable" });
      discard(current);
    }
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
      if (building !== undefined) clearTimeout(building.timer);
      building = undefined;
      if (worker !== undefined) discard(worker);
    },
  };
}
