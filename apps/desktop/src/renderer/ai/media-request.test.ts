import type { MediaId, MediaMeta } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
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

const request = (input: unknown): AiRequest => ({
  kind: "command",
  name: "requestMedia",
  input,
  app: "Claude",
});

function setup(changes: Partial<MediaRequestDeps> = {}) {
  const deps = {
    ask: vi.fn<MediaRequestDeps["ask"]>(async () => true),
    choose: vi.fn<MediaRequestDeps["choose"]>(async () => [photo]),
    add: vi.fn<MediaRequestDeps["add"]>(),
    busy: () => false,
    ...changes,
  };
  return { deps, answer: createMediaRequests(deps) };
}

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
    expect(response).toEqual({
      status: "done",
      data: { added: [{ id: "media-workshop", fileName: "Workshop.jpg", kind: "image" }] },
    });
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
  });

  it("takes a reason only, never a path, and asks one question at a time", async () => {
    const { deps, answer } = setup({
      ask: vi.fn<MediaRequestDeps["ask"]>(() => new Promise<boolean>(() => undefined)),
    });

    expect(await answer(request({ reason: "Photos", path: "C:/Users" }))).toMatchObject({
      status: "invalid",
    });
    expect(await answer(request({ reason: " " }))).toMatchObject({ status: "invalid" });
    expect(deps.ask).not.toHaveBeenCalled();

    void answer(request({ reason: "Photos" }));
    expect(await answer(request({ reason: "More photos" }))).toMatchObject({ status: "busy" });
    expect(deps.ask).toHaveBeenCalledOnce();
  });

  it("waits while the person is busy, and leaves other requests to the command layer", async () => {
    const busy = setup({ busy: () => true });
    expect(await busy.answer(request({ reason: "Photos" }))).toMatchObject({ status: "busy" });
    expect(busy.deps.ask).not.toHaveBeenCalled();

    const { answer } = setup();
    expect(answer({ kind: "query", name: "requestMedia", input: {} })).toBeUndefined();
    expect(answer({ ...request({}), name: "addPage" })).toBeUndefined();
  });
});
