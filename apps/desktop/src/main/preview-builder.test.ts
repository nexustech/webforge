import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { PreviewJob, PreviewOutcome } from "../shared/export-worker-protocol.js";
import { createPreviewBuilder } from "./preview-builder.js";
import type { WorkerProcess } from "./worker-process.js";

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
    workers.flatMap((made) => made.worker.posted as PreviewJob[]).map((each) => each.snapshot.name);
  return { builder, workers, outcomes, latest, names };
}

describe("createPreviewBuilder (3.2)", () => {
  it("builds the latest site waiting, once the one under way is done, never each in between", () => {
    const { builder, outcomes, latest, names } = builderOf();

    builder.request(job("one"));
    builder.request(job("two"));
    builder.request(job("three"));
    expect(names()).toEqual(["one"]);

    latest().reply(built);
    expect(names()).toEqual(["one", "three"]);
    latest().reply(built);
    expect(outcomes).toEqual([built, built]);
    // One worker for them all: it keeps what it built.
    expect(names()).toHaveLength(2);
  });

  it("answers the worker's reads of the site's images", async () => {
    const readMedia = vi.fn(async () => undefined);
    const { builder, latest } = builderOf({ readMedia });
    builder.request(job("one"));

    latest().reply({ type: "read-blob", id: 3, hash: "a".repeat(64) });

    await vi.waitFor(() => expect(latest().worker.posted).toContainEqual({ type: "blob", id: 3 }));
    expect(readMedia).toHaveBeenCalledWith("a".repeat(64));
  });

  it("replaces a worker that answers with anything else, exits or takes too long", () => {
    vi.useFakeTimers();
    try {
      const { builder, workers, outcomes, latest } = builderOf({ timeoutMs: 1000 });

      builder.request(job("one"));
      latest().reply({ type: "previewed", full: true, changed: [{ path: "/etc/passwd" }] });
      expect(outcomes.at(-1)).toEqual({ type: "preview-failed", detail: "invalid-worker-message" });
      expect(workers[0]?.worker.kill).toHaveBeenCalled();

      builder.request(job("two"));
      expect(workers).toHaveLength(2);
      latest().exit(1);
      expect(outcomes.at(-1)).toEqual({ type: "preview-failed", detail: "worker-exit-1" });

      builder.request(job("three"));
      vi.advanceTimersByTime(1000);
      expect(outcomes.at(-1)).toEqual({ type: "preview-failed", detail: "timeout" });
      expect(latest().worker.kill).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a built file outside the preview's own paths", () => {
    const { builder, outcomes, latest } = builderOf();
    builder.request(job("one"));

    latest().reply({
      type: "previewed",
      full: true,
      changed: [{ path: "../outside.html", data: new Uint8Array([1]) }],
      removed: [],
    });

    expect(outcomes).toEqual([{ type: "preview-failed", detail: "invalid-worker-message" }]);
  });

  it("stops its worker when closed, telling nothing more", () => {
    const { builder, outcomes, latest } = builderOf();
    builder.request(job("one"));
    const worker = latest();

    builder.close();
    worker.reply(built);
    builder.request(job("two"));

    expect(worker.worker.kill).toHaveBeenCalled();
    expect(outcomes).toEqual([]);
    expect(worker.worker.posted).toHaveLength(1);
  });
});
