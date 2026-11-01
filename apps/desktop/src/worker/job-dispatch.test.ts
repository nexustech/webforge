import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { FromWorker } from "../shared/worker-channel-protocol.js";
import { createJobDispatch, type JobContext, type JobHandlers } from "./job-dispatch.js";

/** A handler for every kind, failing the test if one it doesn't expect runs. */
const unexpected = () => {
  throw new Error("not this handler");
};

function dispatchOf(handlers: Partial<JobHandlers>) {
  const posted: FromWorker[] = [];
  const dispatch = createJobDispatch(
    {
      export: unexpected,
      preview: unexpected,
      thumbnail: unexpected,
      "class-catalogue": unexpected,
      "class-css": unexpected,
      "item-html": unexpected,
      "compile-css": unexpected,
      ...handlers,
    },
    (message) => posted.push(message),
  );
  return { dispatch, posted };
}

const thumbnail = { type: "thumbnail", mimeType: "image/png", data: new Uint8Array([1]) };

describe("createJobDispatch (A14)", () => {
  it("gives each job to its kind's handler, and its outcome back with its id", async () => {
    const { dispatch, posted } = dispatchOf({
      thumbnail: () => ({ type: "thumbnail-failed" }),
      "class-catalogue": async () => ({ type: "classes-failed" }),
    });

    dispatch({ message: "job", id: 7, job: thumbnail });
    dispatch({ message: "job", id: 8, job: { type: "class-catalogue", theme: DEFAULT_THEME } });

    await vi.waitFor(() => expect(posted).toHaveLength(2));
    expect(posted).toEqual([
      { message: "outcome", id: 7, outcome: { type: "thumbnail-failed" } },
      { message: "outcome", id: 8, outcome: { type: "classes-failed" } },
    ]);
  });

  it("answers a job it doesn't take, and one whose handler throws, with its id", async () => {
    const { dispatch, posted } = dispatchOf({
      thumbnail: () => {
        throw new Error("C:\\Sites\\Bakery");
      },
    });

    dispatch({ message: "job", id: 1, job: { type: "format-disk" } });
    dispatch({ message: "job", id: 2, job: thumbnail });
    // Not the channel's: left, as the main process leaves what it didn't ask for.
    dispatch({ type: "cancel" });

    await vi.waitFor(() => expect(posted).toHaveLength(2));
    expect(posted).toEqual([
      { message: "failed", id: 1, detail: "invalid-job" },
      { message: "failed", id: 2, detail: "unexpected" },
    ]);
  });

  it("cancels the job a cancel names, and no other", async () => {
    const signals = new Map<number, AbortSignal>();
    const finish = new Map<number, () => void>();
    const { dispatch, posted } = dispatchOf({
      thumbnail: (job, { signal }) => {
        const which = job.data[0] ?? -1;
        signals.set(which, signal);
        return new Promise((resolve) => {
          finish.set(which, () => resolve({ type: "thumbnail-failed" }));
        });
      },
    });
    const image = (which: number) => ({ ...thumbnail, data: new Uint8Array([which]) });

    dispatch({ message: "job", id: 1, job: image(1) });
    dispatch({ message: "job", id: 2, job: image(2) });
    await vi.waitFor(() => expect(signals.size).toBe(2));
    dispatch({ message: "cancel", id: 1 });

    expect(signals.get(1)?.aborted).toBe(true);
    expect(signals.get(2)?.aborted).toBe(false);
    finish.get(1)?.();
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    // Once it has finished, a cancel of it reaches nothing.
    dispatch({ message: "cancel", id: 1 });
    expect(signals.get(2)?.aborted).toBe(false);
  });

  it("asks for a job's bytes with its id, and tells its progress with it", async () => {
    let context: JobContext | undefined;
    const { dispatch, posted } = dispatchOf({
      thumbnail: (_job, given) => {
        context = given;
        return new Promise(() => undefined);
      },
    });
    dispatch({ message: "job", id: 4, job: thumbnail });
    await vi.waitFor(() => expect(context).toBeDefined());

    const first = context?.readMedia("a".repeat(64));
    const second = context?.readMedia("b".repeat(64));
    context?.onProgress({ stage: "writing" });
    const photo = { data: new Uint8Array([0xff]), mime: "image/png" };
    dispatch({ message: "blob", id: 4, read: 1 });
    dispatch({ message: "blob", id: 4, read: 0, blob: photo });

    expect(await first).toEqual(photo);
    expect(await second).toBeUndefined();
    expect(posted).toEqual([
      { message: "read-blob", id: 4, read: 0, hash: "a".repeat(64) },
      { message: "read-blob", id: 4, read: 1, hash: "b".repeat(64) },
      { message: "progress", id: 4, progress: { stage: "writing" } },
    ]);
  });
});
