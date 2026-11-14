import { describe, expect, it, vi } from "vitest";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";
import { answerWindowTool, type WindowToolHandlers } from "./window-tools.js";

const DONE: AiResponse = { status: "done", data: null };
const STAGE = "6f1e2d3c-4b5a-4968-8776-655443322110";

function handlers() {
  return {
    runSiteCheck: vi.fn(() => DONE),
    openPreview: vi.fn(() => DONE),
    requestMedia: vi.fn(async () => DONE),
  } satisfies WindowToolHandlers;
}

const query = (name: string, stage?: string): AiRequest => ({
  kind: "query",
  name,
  input: {},
  ...(stage === undefined ? {} : { stage }),
});
const command = (name: string, stage?: string): AiRequest => ({
  kind: "command",
  name,
  input: { reason: "Photos" },
  app: "Claude",
  ...(stage === undefined ? {} : { stage }),
});

describe("the window's own tools, by their definitions (#981)", () => {
  it("answers each with its own handler", async () => {
    const own = handlers();
    expect(answerWindowTool(own, query("runSiteCheck"))).toBe(DONE);
    expect(answerWindowTool(own, query("openPreview"))).toBe(DONE);
    expect(await answerWindowTool(own, command("requestMedia"))).toBe(DONE);
    expect(own.runSiteCheck).toHaveBeenCalledOnce();
    expect(own.openPreview).toHaveBeenCalledOnce();
    expect(own.requestMedia).toHaveBeenCalledOnce();
  });

  it("leaves the command layer's, and any of another kind than its own, to the command layer", () => {
    const own = handlers();
    expect(answerWindowTool(own, query("outline"))).toBeUndefined();
    expect(answerWindowTool(own, command("addPage"))).toBeUndefined();
    expect(answerWindowTool(own, command("openPreview"))).toBeUndefined();
    expect(answerWindowTool(own, query("requestMedia"))).toBeUndefined();
    expect(Object.values(own).every((each) => each.mock.calls.length === 0)).toBe(true);
  });

  it("answers a held reply's reads, never a change of its (6.9e)", () => {
    const own = handlers();
    expect(answerWindowTool(own, query("runSiteCheck", STAGE))).toBe(DONE);
    expect(answerWindowTool(own, command("requestMedia", STAGE))).toBeUndefined();
    expect(own.requestMedia).not.toHaveBeenCalled();
  });
});
