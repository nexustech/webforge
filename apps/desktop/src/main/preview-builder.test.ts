import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { PreviewJob, PreviewOutcome } from "../shared/export-worker-protocol.js";
import { fakeWorker } from "./fake-worker.test-helper.js";
import { createPreviewBuilder } from "./preview-builder.js";

/** A preview job for a site named `name`. */
const job = (name: string): PreviewJob => ({
  type: "preview",
  families: [],
  fonts: [],
  snapshot: {
    name,
    language: "en",
    theme: DEFAULT_THEME,
    layout: { header: [], footer: [] },
    pages: [
      { id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } },
    ],
    media: [],
  },
});

const built: PreviewOutcome = {
  type: "previewed",
  full: true,
  changed: [{ path: "index.html", data: new Uint8Array([1]) }],
  removed: [],
};

/** Lets the builder hear what its channel resolved: a few turns of the microtask queue. */
const settle = async () => {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
};

/** Answers the job `made` was sent last with `outcome`. */
const reply = (made: ReturnType<typeof fakeWorker>, outcome: Record<string, unknown>) =>
  made.answer({ id: made.jobs.at(-1)?.id, ...outcome });

function builderOf(options: { timeoutMs?: number; readMedia?: () => Promise<undefined> } = {}) {
  const workers: ReturnType<typeof fakeWorker>[] = [];
  const outcomes: PreviewOutcome[] = [];
  const builder = createPreviewBuilder(
    () => {
      const made = fakeWorker();
      workers.push(made);
      return made.worker;
    },
    {
      readMedia: options.readMedia ?? (async () => undefined),
      onBuilt: (outcome) => outcomes.push(outcome),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    },
  );
  const latest = () => workers.at(-1) ?? fakeWorker();
  const names = () =>
    workers
      .flatMap((made) => made.jobs as unknown as PreviewJob[])
      .map((each) => each.snapshot.name);
  return { builder, workers, outcomes, latest, names };
}

describe("createPreviewBuilder (3.2)", () => {
  it("builds the latest site waiting, once the one under way is done, never each in between", async () => {
    const { builder, outcomes, latest, names } = builderOf();

    builder.request(job("one"));
    builder.request(job("two"));
    builder.request(job("three"));
    expect(names()).toEqual(["one"]);

    reply(latest(), built);
    await settle();
    expect(names()).toEqual(["one", "three"]);
    reply(latest(), built);
    await settle();
    expect(outcomes).toEqual([built, built]);
    // One worker for them all: it keeps what it built.
    expect(names()).toHaveLength(2);
  });

  it("answers the worker's reads of the site's images", async () => {
    const readMedia = vi.fn(async () => undefined);
    const { builder, latest } = builderOf({ readMedia });
    builder.request(job("one"));
    const id = latest().jobs[0]?.id ?? -1;

    latest().send({ message: "read-blob", id, read: 3, hash: "a".repeat(64) });

    await vi.waitFor(() => expect(latest().sent).toContainEqual({ message: "blob", id, read: 3 }));
    expect(readMedia).toHaveBeenCalledWith("a".repeat(64));
  });

  it("replaces a worker that answers with anything else, exits or takes too long", async () => {
    vi.useFakeTimers();
    try {
      const { builder, workers, outcomes, latest } = builderOf({ timeoutMs: 1000 });

      builder.request(job("one"));
      reply(latest(), { type: "previewed", full: true, changed: [{ path: "/etc/passwd" }] });
      await settle();
      expect(outcomes.at(-1)).toEqual({ type: "preview-failed", detail: "invalid-worker-message" });
      expect(workers[0]?.worker.kill).toHaveBeenCalled();

      builder.request(job("two"));
      expect(workers).toHaveLength(2);
      latest().exit(1);
      await settle();
      expect(outcomes.at(-1)).toEqual({ type: "preview-failed", detail: "worker-exit-1" });

      builder.request(job("three"));
      vi.advanceTimersByTime(1000);
      await settle();
      expect(outcomes.at(-1)).toEqual({ type: "preview-failed", detail: "timeout" });
      expect(latest().worker.kill).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a built file outside the preview's own paths", async () => {
    const { builder, outcomes, latest } = builderOf();
    builder.request(job("one"));

    reply(latest(), {
      type: "previewed",
      full: true,
      changed: [{ path: "../outside.html", data: new Uint8Array([1]) }],
      removed: [],
    });
    await settle();

    expect(outcomes).toEqual([{ type: "preview-failed", detail: "invalid-worker-message" }]);
  });

  it("stops its worker when closed, telling nothing more", async () => {
    const { builder, outcomes, latest } = builderOf();
    builder.request(job("one"));
    const worker = latest();

    builder.close();
    reply(worker, built);
    builder.request(job("two"));
    await settle();

    expect(worker.worker.kill).toHaveBeenCalled();
    expect(outcomes).toEqual([]);
    expect(worker.jobs).toHaveLength(1);
  });
});
