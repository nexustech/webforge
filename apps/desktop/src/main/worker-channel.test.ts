import { DEFAULT_THEME } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ThumbnailJob,
  thumbnailOutcomeSchema,
  type WorkerJob,
} from "../shared/export-worker-protocol.js";
import { fakeWorker } from "./fake-worker.test-helper.js";
import { createWorkerChannel } from "./worker-channel.js";

const thumbnail: ThumbnailJob = {
  type: "thumbnail",
  mimeType: "image/png",
  data: new Uint8Array([1]),
};
const catalogue: WorkerJob = { type: "class-catalogue", theme: DEFAULT_THEME };
const options = { outcome: thumbnailOutcomeSchema, timeoutMs: 1_000 };

/** A channel over workers the test makes, one per start. */
function channelOf() {
  const workers: ReturnType<typeof fakeWorker>[] = [];
  const start = vi.fn(() => {
    const made = fakeWorker();
    workers.push(made);
    return made.worker;
  });
  const channel = createWorkerChannel(start);
  const latest = () => workers.at(-1) ?? fakeWorker();
  return { channel, workers, latest, start };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createWorkerChannel (A14)", () => {
  it("matches each outcome to its job by id, whatever order they come in", async () => {
    const { channel, latest, start } = channelOf();

    const first = channel.run(thumbnail, options);
    const second = channel.run(thumbnail, options);
    const [a, b] = latest().jobs;
    latest().answer({ id: b?.id, type: "thumbnail", data: new Uint8Array([2]) });
    latest().answer({ id: a?.id, type: "thumbnail-failed" });

    expect(await first).toEqual({ ok: true, outcome: { type: "thumbnail-failed" } });
    expect(await second).toEqual({
      ok: true,
      outcome: { type: "thumbnail", data: new Uint8Array([2]) },
    });
    expect(start).toHaveBeenCalledOnce();
  });

  it("cancels the job its signal is for, and no other", async () => {
    const { channel, latest } = channelOf();
    const cancelled = new AbortController();

    const stopped = channel.run(thumbnail, { ...options, signal: cancelled.signal });
    const other = channel.run(thumbnail, options);
    const [a, b] = latest().jobs;
    cancelled.abort();
    latest().answer({ id: a?.id, type: "thumbnail-failed" });
    latest().answer({ id: b?.id, type: "thumbnail", data: new Uint8Array([3]) });

    expect(latest().sent.filter((message) => message.message === "cancel")).toEqual([
      { message: "cancel", id: a?.id },
    ]);
    expect(await stopped).toMatchObject({ ok: true });
    expect(await other).toEqual({
      ok: true,
      outcome: { type: "thumbnail", data: new Uint8Array([3]) },
    });
  });

  it("gives each job's reads and progress to that job alone", async () => {
    const { channel, latest } = channelOf();
    const photo = { data: new Uint8Array([0xff]), mime: "image/png" };
    const readA = vi.fn(async () => photo);
    const readB = vi.fn(async () => undefined);
    const progressA = vi.fn();

    void channel.run(thumbnail, { ...options, readMedia: readA, onProgress: progressA });
    void channel.run(thumbnail, { ...options, readMedia: readB });
    const [a, b] = latest().jobs.map((job) => job.id);
    latest().send({ message: "read-blob", id: b ?? -1, read: 0, hash: "b".repeat(64) });
    latest().send({ message: "read-blob", id: a ?? -1, read: 1, hash: "a".repeat(64) });
    latest().send({ message: "progress", id: a ?? -1, progress: { stage: "writing" } });

    await vi.waitFor(() =>
      expect(latest().sent.filter((message) => message.message === "blob")).toHaveLength(2),
    );
    expect(readA).toHaveBeenCalledWith("a".repeat(64));
    expect(readB).toHaveBeenCalledWith("b".repeat(64));
    expect(latest().sent).toContainEqual({ message: "blob", id: a, read: 1, blob: photo });
    expect(latest().sent).toContainEqual({ message: "blob", id: b, read: 0 });
    expect(progressA).toHaveBeenCalledWith({ stage: "writing" });
  });

  it("passes the worker's own failure on: a job it doesn't take", async () => {
    const { channel, latest } = channelOf();

    const result = channel.run(catalogue, options);
    latest().send({ message: "failed", id: latest().jobs[0]?.id ?? -1, detail: "invalid-job" });

    expect(await result).toEqual({ ok: false, reason: "invalid-job" });
  });

  it("stops a worker that sends anything but the channel's, failing its jobs", async () => {
    const { channel, latest, workers } = channelOf();

    const result = channel.run(thumbnail, options);
    // A crash report is the crash handlers' (R3): not the channel's to judge.
    latest().send({
      type: "crashed",
      kind: "uncaught-exception",
      error: { name: "Error", frames: [] },
    });
    latest().send({ type: "thumbnail", path: "/secret" });

    expect(await result).toEqual({ ok: false, reason: "invalid-worker-message" });
    expect(workers[0]?.worker.kill).toHaveBeenCalledOnce();
    void channel.run(thumbnail, options);
    expect(workers).toHaveLength(2);
  });

  it("stops a worker whose outcome its job's schema doesn't take", async () => {
    const { channel, latest } = channelOf();

    const result = channel.run(thumbnail, options);
    latest().answer({ id: latest().jobs[0]?.id, type: "thumbnail", data: "not bytes" });

    expect(await result).toEqual({ ok: false, reason: "invalid-worker-message" });
    expect(latest().worker.kill).toHaveBeenCalled();
  });

  it("fails every job of a worker that exits, and of one that takes too long", async () => {
    vi.useFakeTimers();
    const { channel, workers, latest } = channelOf();

    const lost = [channel.run(thumbnail, options), channel.run(thumbnail, options)];
    latest().exit(3);
    expect(await Promise.all(lost)).toEqual([
      { ok: false, reason: "worker-exit-3" },
      { ok: false, reason: "worker-exit-3" },
    ]);

    const stuck = channel.run(thumbnail, options);
    vi.advanceTimersByTime(1_000);
    expect(await stuck).toEqual({ ok: false, reason: "timeout" });
    expect(workers[1]?.worker.kill).toHaveBeenCalled();
  });

  it("fails a job whose worker can't start or be sent it, and tries again next time", async () => {
    let starts = 0;
    const made = fakeWorker();
    const channel = createWorkerChannel(() => {
      starts += 1;
      if (starts === 1) throw new Error("fork failed");
      return made.worker;
    });
    expect(await channel.run(thumbnail, options)).toEqual({
      ok: false,
      reason: "worker-start-failed",
    });

    made.worker.postMessage = () => {
      throw new Error("channel closed");
    };
    expect(await channel.run(thumbnail, options)).toEqual({
      ok: false,
      reason: "worker-unreachable",
    });
    expect(made.worker.kill).toHaveBeenCalled();
  });

  it("ends the jobs under way when closed, and ignores what their worker says after", async () => {
    const { channel, latest, workers } = channelOf();

    const result = channel.run(thumbnail, options);
    const worker = latest();
    channel.close();
    worker.answer({ id: worker.jobs[0]?.id, type: "thumbnail-failed" });

    expect(await result).toEqual({ ok: false, reason: "closed" });
    expect(worker.worker.kill).toHaveBeenCalled();
    void channel.run(thumbnail, options);
    expect(workers).toHaveLength(2);
  });
});
