import type { MediaId, MediaMeta } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequest } from "../../shared/ipc/ai.js";
import { createMediaRequests, type MediaRequestDeps } from "./media-request.js";

const photo: MediaMeta = {
  id: "media-workshop" as MediaId,
  kind: "image",
  hash: "a".repeat(64),
  name: "workshop",
  fileName: "Workshop.jpg",
  mimeType: "image/jpeg",
  width: 1600,
  height: 900,
  alt: "",
};

const ADDED = {
  status: "done",
  data: { added: [{ id: "media-workshop", fileName: "Workshop.jpg", kind: "image" }] },
};

const request = (input: unknown, app = "Claude"): AiRequest => ({
  kind: "command",
  name: "requestMedia",
  input,
  app,
});

const status = (input: unknown): AiRequest => ({ kind: "query", name: "mediaStatus", input });

function setup(changes: Partial<MediaRequestDeps> = {}) {
  const deps = {
    ask: vi.fn<MediaRequestDeps["ask"]>(async () => true),
    choose: vi.fn<MediaRequestDeps["choose"]>(async () => [photo]),
    add: vi.fn<MediaRequestDeps["add"]>(),
    busy: () => false,
    firstId: 1,
    ...changes,
  };
  const requests = createMediaRequests(deps);
  return { deps, requests, answer: requests.requestMedia };
}

/** An Add files dialog the test closes: `pick` resolves it with what the person chose. */
function dialog() {
  let pick: (items: readonly MediaMeta[]) => void = () => undefined;
  const choose = vi.fn<MediaRequestDeps["choose"]>(
    () =>
      new Promise((resolve) => {
        pick = resolve;
      }),
  );
  return { choose, pick: (items: readonly MediaMeta[]) => pick(items) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("requestMedia (4.12b, AIB-7)", () => {
  it("asks with the app's reason, opens Add files, and answers with what the person added", async () => {
    const { deps, answer } = setup();

    const response = await answer(request({ reason: "Photos of your workshop" }));

    expect(deps.ask).toHaveBeenCalledWith(
      { app: "Claude", reason: "Photos of your workshop" },
      expect.any(AbortSignal),
    );
    expect(deps.choose).toHaveBeenCalledOnce();
    expect(deps.add).toHaveBeenCalledWith([photo]);
    expect(response).toEqual(ADDED);
  });

  it("adds nothing when the person says not now, chooses nothing, or doesn't answer", async () => {
    const notNow = setup({ ask: async () => false });
    expect(await notNow.answer(request({ reason: "Photos" }))).toMatchObject({
      status: "declined",
    });
    expect(notNow.deps.choose).not.toHaveBeenCalled();

    const none = setup({ choose: async () => [] });
    expect(await none.answer(request({ reason: "Photos" }))).toMatchObject({
      status: "declined",
    });
    expect(none.deps.add).not.toHaveBeenCalled();

    // A question nobody answers closes after its time, as an AI app's Allow does.
    const unanswered = setup({
      askForMs: 5,
      ask: (_asked, signal) =>
        new Promise((resolve) => signal.addEventListener("abort", () => resolve(false))),
    });
    expect(await unanswered.answer(request({ reason: "Photos" }))).toMatchObject({
      status: "declined",
    });

    // Add files failing adds nothing, and frees the next request.
    const failed = setup({ choose: async () => Promise.reject(new Error("import")) });
    expect(await failed.answer(request({ reason: "Photos" }))).toMatchObject({
      status: "declined",
    });
    expect(await failed.answer(request({ reason: "Photos" }))).toMatchObject({
      status: "declined",
    });
  });

  it("takes a reason only, never a path", async () => {
    const { deps, answer } = setup();

    expect(await answer(request({ reason: "Photos", path: "C:/Users" }))).toMatchObject({
      status: "invalid",
    });
    expect(await answer(request({ reason: " " }))).toMatchObject({ status: "invalid" });
    expect(await answer({ kind: "query", name: "requestMedia", input: {} })).toMatchObject({
      status: "invalid",
    });
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("waits while the person is busy", async () => {
    const busy = setup({ busy: () => true });
    expect(await busy.answer(request({ reason: "Photos" }))).toMatchObject({ status: "busy" });
    expect(busy.deps.ask).not.toHaveBeenCalled();
  });
});

describe("a request the person takes minutes over (#1252)", () => {
  it("answers waiting with its id, and mediaStatus gives the files chosen after the old timeout", async () => {
    vi.useFakeTimers();
    const { choose, pick } = dialog();
    const { deps, requests } = setup({ choose });

    const first = requests.requestMedia(request({ reason: "Photos of your workshop" }));
    await vi.advanceTimersByTimeAsync(45_000);
    expect(await first).toEqual({
      status: "waiting",
      data: { requestId: 1 },
      message: expect.stringContaining("choosing files in Add files"),
    });
    expect(requests.mediaStatus(status({ requestId: 1 }))).toMatchObject({
      status: "waiting",
      data: { requestId: 1 },
    });

    // Three minutes on, well past main's 75 s: the files still reach the app.
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    pick([photo]);
    await vi.advanceTimersByTimeAsync(0);
    expect(deps.add).toHaveBeenCalledWith([photo]);
    expect(requests.mediaStatus(status({ requestId: 1 }))).toEqual(ADDED);
    // Read again: still there, as a query doesn't say which app reads it.
    expect(requests.mediaStatus(status({ requestId: 1 }))).toEqual(ADDED);

    // Kept for half an hour, then gone.
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(requests.mediaStatus(status({ requestId: 1 }))).toMatchObject({
      status: "not-found",
    });
  });

  it("tells a second ask that the first is still open, with its id, not that Webforge is busy", async () => {
    const { choose, pick } = dialog();
    const { deps, requests } = setup({ choose });

    const first = requests.requestMedia(request({ reason: "Photos" }));
    await vi.waitFor(() => expect(choose).toHaveBeenCalledOnce());

    const again = await requests.requestMedia(request({ reason: "More photos" }));
    expect(again).toMatchObject({ status: "waiting", data: { requestId: 1 } });
    expect(again).toMatchObject({ message: expect.stringContaining("is still open") });
    expect(again).toMatchObject({ message: expect.stringContaining("Add files") });
    // Another app's is told the person is choosing for someone else.
    expect(await requests.requestMedia(request({ reason: "Logos" }, "Cursor"))).toMatchObject({
      status: "busy",
      message: expect.stringContaining("another app"),
    });
    expect(deps.ask).toHaveBeenCalledOnce();

    // The first ask still answers, and the id the second was given says the same.
    pick([photo]);
    expect(await first).toEqual(ADDED);
    expect(requests.mediaStatus(status({ requestId: 1 }))).toEqual(ADDED);
    // The next request is a new one, asked again.
    void requests.requestMedia(request({ reason: "Photos" }));
    await vi.waitFor(() => expect(deps.ask).toHaveBeenCalledTimes(2));
  });

  it("says a question not yet answered is waiting on the person", async () => {
    const { requests } = setup({
      answerWithinMs: 5,
      ask: () => new Promise<boolean>(() => undefined),
    });
    expect(await requests.requestMedia(request({ reason: "Photos" }))).toMatchObject({
      status: "waiting",
      message: expect.stringContaining("hasn't answered your question"),
    });
  });

  it("numbers each opening's requests from a random start", async () => {
    const ids = [0, 1].map(async () => {
      const requests = createMediaRequests({
        ask: () => new Promise<boolean>(() => undefined),
        choose: async () => [],
        add: () => undefined,
        busy: () => false,
        answerWithinMs: 1,
      });
      const waiting = await requests.requestMedia(request({ reason: "Photos" }));
      return waiting.status === "waiting" && "requestId" in waiting.data
        ? waiting.data.requestId
        : undefined;
    });
    const [first, second] = await Promise.all(ids);
    expect(first).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });

  it("keeps nothing for a request answered at once, nor for one whose site closed", async () => {
    const { choose, pick } = dialog();
    const { requests } = setup({ choose, answerWithinMs: 5 });
    const done = setup();

    expect(await done.answer(request({ reason: "Photos" }))).toEqual(ADDED);
    expect(done.requests.mediaStatus(status({ requestId: 1 }))).toMatchObject({
      status: "not-found",
    });

    expect(await requests.requestMedia(request({ reason: "Photos" }))).toMatchObject({
      status: "waiting",
    });
    requests.close();
    pick([photo]);
    await vi.waitFor(() =>
      expect(requests.mediaStatus(status({ requestId: 1 }))).toMatchObject({
        status: "not-found",
      }),
    );
    expect(requests.mediaStatus(status({ requestId: 0 }))).toMatchObject({ status: "invalid" });
  });
});
