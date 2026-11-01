import { describe, expect, it } from "vitest";
import {
  type ThumbnailJob,
  type ThumbnailOutcome,
  thumbnailOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import type { WorkerProcess } from "./worker-process.js";
import { createWorkerRequests } from "./worker-requests.js";

/** A worker that answers each job with the outcome `answer` makes, as the real one would. */
function answeringWorker(answer: (job: unknown) => unknown): WorkerProcess {
  const listeners: ((message: unknown) => void)[] = [];
  return {
    postMessage: (message) => {
      const { id, job } = message as { id: number; job: unknown };
      queueMicrotask(() => {
        for (const listener of listeners)
          listener({ message: "outcome", id, outcome: answer(job) });
      });
    },
    on: ((event: string, listener: (message: unknown) => void) => {
      if (event === "message") listeners.push(listener);
    }) as WorkerProcess["on"],
    kill: () => true,
  };
}

describe("createWorkerRequests", () => {
  it("sends a job, and gives the worker's answer to it", async () => {
    const request = createWorkerRequests<ThumbnailOutcome, ThumbnailJob>(
      () => answeringWorker(() => ({ type: "thumbnail", data: new Uint8Array([7]) })),
      thumbnailOutcomeSchema,
      1_000,
    );

    await expect(
      request({ type: "thumbnail", mimeType: "image/png", data: new Uint8Array([1]) }),
    ).resolves.toEqual({ type: "thumbnail", data: new Uint8Array([7]) });
  });

  it("takes only the jobs its worker takes: any other fails to compile (R13c)", () => {
    // Never run: what matters is that these lines don't typecheck.
    const misuse = (
      request: ReturnType<typeof createWorkerRequests<ThumbnailOutcome, ThumbnailJob>>,
    ) => {
      // @ts-expect-error a job of another kind than this worker's
      void request({ type: "compile-css", css: "" });
      // @ts-expect-error a thumbnail job without its bytes
      void request({ type: "thumbnail", mimeType: "image/png" });
      // @ts-expect-error a field the job doesn't have
      void request({ type: "thumbnail", mimeType: "image/png", data: new Uint8Array(), size: 1 });
      // @ts-expect-error an id: the channel gives each job its own
      void request({ type: "thumbnail", mimeType: "image/png", data: new Uint8Array(), id: 3 });
    };

    expect(misuse).toBeTypeOf("function");
  });
});
