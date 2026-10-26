import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { ExportJob } from "../shared/export-worker-protocol.js";
import { createExportRunner, type ExportOptions } from "./export-worker-client.js";
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

const exported = {
  type: "exported",
  pages: 1,
  files: 5,
  bytes: 10,
  warnings: 0,
  durationMs: 5,
} as const;

/** The main process's side: no stored bytes unless a test gives some. */
const options = (extra: Partial<ExportOptions> = {}): ExportOptions => ({
  readMedia: async () => undefined,
  ...extra,
});

/** A worker the test drives: it records what it was sent and answers when told to. */
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

/** A runner over workers the test makes, one per start. */
function runnerOf(timeoutMs?: number) {
  const workers: ReturnType<typeof fakeWorker>[] = [];
  const runner = createExportRunner(() => {
    const made = fakeWorker();
    workers.push(made);
    return made.worker;
  }, timeoutMs);
  const latest = () => workers.at(-1) ?? fakeWorker();
  /** Waits until the latest worker has been sent `count` messages: runs start once it's their turn. */
  const sent = (count = 1) =>
    vi.waitFor(() =>
      expect(workers.at(-1)?.worker.posted.length ?? 0).toBeGreaterThanOrEqual(count),
    );
  return { runner, workers, latest, sent };
}

describe("createExportRunner", () => {
  it("runs an export in its worker and keeps the worker for the next one (R15)", async () => {
    const { runner, workers, latest, sent } = runnerOf();

    const first = runner.run(job, options());
    await sent();
    latest().reply(exported);
    await expect(first).resolves.toEqual(exported);

    const second = runner.run(job, options());
    await vi.waitFor(() => expect(latest().worker.posted).toHaveLength(2));
    latest().reply(exported);
    await expect(second).resolves.toEqual(exported);

    // One worker, for both, still running: its cache serves the second export.
    expect(workers).toHaveLength(1);
    expect(latest().worker.posted).toEqual([job, job]);
    expect(latest().worker.kill).not.toHaveBeenCalled();
  });

  it("runs one export at a time, the next once the one before is done", async () => {
    const { runner, latest, sent } = runnerOf();

    const first = runner.run(job, options());
    const second = runner.run(job, options());
    await sent();
    expect(latest().worker.posted).toEqual([job]);

    latest().reply(exported);
    await first;
    await vi.waitFor(() => expect(latest().worker.posted).toEqual([job, job]));
    latest().reply({ type: "cancelled" });
    await expect(second).resolves.toEqual({ type: "cancelled" });
  });

  it("treats an unexpected message as a failed build, and starts a fresh worker next time", async () => {
    const { runner, workers, latest, sent } = runnerOf();
    const outcome = runner.run(job, options());
    await sent();

    latest().reply({ type: "exported", path: "/secret" });

    await expect(outcome).resolves.toEqual({
      type: "failed",
      code: "build-failed",
      detail: "invalid-worker-message",
    });
    expect(latest().worker.kill).toHaveBeenCalled();
    void runner.run(job, options());
    await vi.waitFor(() => expect(workers).toHaveLength(2));
  });

  it("fails if the worker exits without answering, and starts a fresh one next time", async () => {
    const { runner, workers, latest, sent } = runnerOf();
    const crash = runner.run(job, options());
    await sent();

    latest().exit(3);

    await expect(crash).resolves.toEqual({
      type: "failed",
      code: "build-failed",
      detail: "worker-exit-3",
    });
    void runner.run(job, options());
    await vi.waitFor(() => expect(workers).toHaveLength(2));
  });

  it("fails an export whose worker can't start, and runs the next one (3.1 review)", async () => {
    const made = fakeWorker();
    let starts = 0;
    const runner = createExportRunner(() => {
      starts += 1;
      if (starts === 1) throw new Error("fork failed");
      return made.worker;
    });

    await expect(runner.run(job, options())).resolves.toEqual({
      type: "failed",
      code: "build-failed",
      detail: "worker-start-failed",
    });
    const next = runner.run(job, options());
    await vi.waitFor(() => expect(made.worker.posted).toEqual([job]));
    made.reply(exported);
    await expect(next).resolves.toEqual(exported);
  });

  it("fails an export its worker can't be sent, and starts a fresh one next time", async () => {
    const { runner, workers, latest, sent } = runnerOf();
    const first = runner.run(job, options());
    await sent();
    latest().reply(exported);
    await first;
    latest().worker.postMessage = () => {
      throw new Error("channel closed");
    };

    await expect(runner.run(job, options())).resolves.toEqual({
      type: "failed",
      code: "build-failed",
      detail: "worker-unreachable",
    });
    expect(latest().worker.kill).toHaveBeenCalled();
    void runner.run(job, options());
    await vi.waitFor(() => expect(workers).toHaveLength(2));
  });

  it("stops a worker that does not answer in time", async () => {
    vi.useFakeTimers();
    try {
      const { runner, latest } = runnerOf(1_000);
      const outcome = runner.run(job, options());

      await vi.advanceTimersByTimeAsync(1_000);

      await expect(outcome).resolves.toEqual({
        type: "failed",
        code: "build-failed",
        detail: "timeout",
      });
      expect(latest().worker.kill).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops the worker when the site closes, so its cached images go too (R15)", async () => {
    const { runner, workers, latest, sent } = runnerOf();
    const outcome = runner.run(job, options());
    await sent();
    latest().reply(exported);
    await outcome;

    runner.close();

    expect(latest().worker.kill).toHaveBeenCalled();
    void runner.run(job, options());
    await vi.waitFor(() => expect(workers).toHaveLength(2));
    // Closing with no worker running does nothing.
    runnerOf().runner.close();
  });

  it("answers the worker's requests for stored bytes as they come, with only the bytes and type (R15)", async () => {
    const { runner, latest } = runnerOf();
    const photo = { data: new Uint8Array([0xff, 0xd8]), mime: "image/jpeg", extra: "not sent" };
    const readMedia = vi.fn(async (hash: string) => {
      if (hash === "c".repeat(64)) throw new Error("locked");
      return hash === "a".repeat(64) ? photo : undefined;
    });
    void runner.run(job, options({ readMedia }));
    await vi.waitFor(() => expect(latest().worker.posted).toHaveLength(1));
    // Nothing is read before the worker asks.
    expect(readMedia).not.toHaveBeenCalled();

    latest().reply({ type: "read-blob", id: 0, hash: "a".repeat(64) });
    latest().reply({ type: "read-blob", id: 1, hash: "b".repeat(64) });
    latest().reply({ type: "read-blob", id: 2, hash: "c".repeat(64) });
    await vi.waitFor(() => expect(latest().worker.posted).toHaveLength(4));

    expect(latest().worker.posted.slice(1)).toEqual([
      { type: "blob", id: 0, blob: { data: photo.data, mime: "image/jpeg" } },
      // Not stored, or not readable: the build leaves it out.
      { type: "blob", id: 1 },
      { type: "blob", id: 2 },
    ]);
  });

  it("passes the worker's progress on, for the export under way only (3.1)", async () => {
    const { runner, latest, sent } = runnerOf();
    const onProgress = vi.fn();
    const outcome = runner.run(job, options({ onProgress }));
    await sent();

    latest().reply({ type: "progress", progress: { stage: "pages", done: 0, total: 1 } });
    latest().reply({ type: "progress", progress: { stage: "writing" } });
    latest().reply(exported);
    await outcome;
    latest().reply({ type: "progress", progress: { stage: "fonts" } });

    expect(onProgress.mock.calls).toEqual([
      [{ stage: "pages", done: 0, total: 1 }],
      [{ stage: "writing" }],
    ]);
  });

  it("tells the worker to stop when cancelled, and resolves with its cancelled outcome (R15)", async () => {
    const { runner, latest } = runnerOf();
    const controller = new AbortController();
    const outcome = runner.run(job, options({ signal: controller.signal }));
    await vi.waitFor(() => expect(latest().worker.posted).toHaveLength(1));

    controller.abort();
    latest().reply({ type: "cancelled" });

    await expect(outcome).resolves.toEqual({ type: "cancelled" });
    expect(latest().worker.posted).toEqual([job, { type: "cancel" }]);

    // Cancelled before it started: the worker is told with the job.
    const late = runnerOf();
    void late.runner.run(job, options({ signal: controller.signal }));
    await vi.waitFor(() => expect(late.latest().worker.posted).toEqual([job, { type: "cancel" }]));
  });
});
