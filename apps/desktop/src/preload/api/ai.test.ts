import { describe, expect, it, vi } from "vitest";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";
import { aiApi } from "./ai.js";
import { createCall } from "./call.js";

const SESSION = "11111111-1111-4111-8111-111111111111";
const addHero: AiRequest = {
  kind: "command",
  name: "addNode",
  input: { type: "Hero" },
  app: "Assistant",
};

describe("the ai API's requests (4.8, 6.9b)", () => {
  it("calls the cancel of a request main cancels, and of no other", async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const invoke = vi.fn(async () => null);
    const api = aiApi(
      createCall(invoke),
      vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
        listeners.set(channel, listener);
        return () => listeners.delete(channel);
      }),
    );
    const cancelled = new Set<number>();
    const answers = new Map<number, (response: AiResponse) => void>();
    let next = 1;
    const stop = api.onRequest(SESSION, (_request, onCancel) => {
      const id = next++;
      onCancel(() => cancelled.add(id));
      return new Promise((resolve) => answers.set(id, resolve));
    });

    listeners.get("ai:request")?.(1, addHero);
    listeners.get("ai:request")?.(2, addHero);
    listeners.get("ai:cancel")?.(1);
    // Something that isn't a request's id is ignored.
    listeners.get("ai:cancel")?.("all");
    expect([...cancelled]).toEqual([1]);

    // The cancelled request still answers, declined by the command layer.
    answers.get(1)?.({ status: "declined", message: "Stopped." });
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("ai:answer", 1, {
        status: "declined",
        message: "Stopped.",
      }),
    );
    stop();
    expect(listeners.has("ai:request")).toBe(false);
    expect(listeners.has("ai:cancel")).toBe(false);
  });
});
