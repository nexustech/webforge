import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { ExportJob } from "../shared/export-worker-protocol.js";
import { runExportInWorker } from "./export-worker-client.js";
import type { WorkerProcess } from "./worker-process.js";

const job: ExportJob = {
  type: "export",
  destination: "/sites/my-site",
  families: [],
  snapshot: {
    name: "Bakery",
    language: "en",
    theme: { ...DEFAULT_THEME, preset: "light" },
    layout: { header: [], footer: [] },
    pages: [
      { id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } },
    ],
    media: [],
  },
  fonts: [],
};

/** A worker the test drives: it records the job and answers when told to. */
function fakeWorker() {
  const listeners: { message?: (message: unknown) => void; exit?: (code: number) => void } = {};
  const worker = {
    posted: [] as unknown[],
    postMessage: (message: unknown) => {
      worker.posted.push(message);
    },
    on: (event: "message" | "exit", listener: (value: never) => void) => {
      listeners[event] = listener as never;
      return worker;
    },
    kill: vi.fn(() => true),
  };
  return {
    worker: worker as typeof worker & WorkerProcess,
    reply: (message: unknown) => listeners.message?.(message),
    exit: (code: number) => listeners.exit?.(code),
  };
}

describe("runExportInWorker", () => {
  it("sends the job and resolves with the worker's outcome, then stops the worker", async () => {
    const { worker, reply } = fakeWorker();
    const outcome = runExportInWorker(() => worker, job);
    const exported = {
      type: "exported",
      pages: 1,
      files: 5,
      bytes: 10,
      warnings: 0,
      durationMs: 5,
    };

    reply(exported);

    await expect(outcome).resolves.toEqual(exported);
    expect(worker.posted).toEqual([job]);
    expect(worker.kill).toHaveBeenCalled();
  });

  it("treats an unexpected message as a failed build", async () => {
    const { worker, reply } = fakeWorker();
    const outcome = runExportInWorker(() => worker, job);

    reply({ type: "exported", path: "/secret" });

    await expect(outcome).resolves.toEqual({
      type: "failed",
      code: "build-failed",
      detail: "invalid-worker-message",
    });
  });

  it("fails if the worker exits without answering, and ignores a late exit", async () => {
    const crashed = fakeWorker();
    const crash = runExportInWorker(() => crashed.worker, job);
    crashed.exit(3);
    await expect(crash).resolves.toEqual({
      type: "failed",
      code: "build-failed",
      detail: "worker-exit-3",
    });

    const finished = fakeWorker();
    const done = runExportInWorker(() => finished.worker, job);
    finished.reply({ type: "failed", code: "write-failed", detail: "write-failed" });
    finished.exit(0);
    await expect(done).resolves.toMatchObject({ code: "write-failed" });
  });

  it("stops a worker that does not answer in time", async () => {
    vi.useFakeTimers();
    try {
      const { worker } = fakeWorker();
      const outcome = runExportInWorker(() => worker, job, 1_000);

      await vi.advanceTimersByTimeAsync(1_000);

      await expect(outcome).resolves.toEqual({
        type: "failed",
        code: "build-failed",
        detail: "timeout",
      });
      expect(worker.kill).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
