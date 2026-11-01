import { describe, expect, it, vi } from "vitest";
import type { AiRequest, AiResponse } from "../shared/ipc/ai.js";
import { createAppLimits, DECLINED_BACK_OFF_MS, PER_MINUTE } from "./mcp-limits.js";

const query: AiRequest = { kind: "query", name: "outline", input: {} };
const command: AiRequest = {
  kind: "command",
  name: "addPage",
  input: { title: "Menu" },
  app: "Claude",
};

function setUp(answer: AiResponse = { status: "done", label: "Added" }) {
  let time = 0;
  const ask = vi.fn(async (): Promise<AiResponse> => answer);
  return {
    ask,
    limits: createAppLimits(ask, () => time),
    later: (ms: number) => {
      time += ms;
    },
  };
}

describe("each AI app's limits (S20, ADR 0021)", () => {
  it("answers busy past an app's rate, for that app only, until the minute has passed", async () => {
    const { limits, ask, later } = setUp();
    for (let n = 0; n < PER_MINUTE.command; n++) await limits.ask("claude", command);

    expect(await limits.ask("claude", command)).toMatchObject({ status: "busy" });
    expect((await limits.ask("cursor", command)).status).toBe("done");
    expect((await limits.ask("claude", query)).status).toBe("done");
    expect(ask).toHaveBeenCalledTimes(PER_MINUTE.command + 2);

    later(60_000);
    expect((await limits.ask("claude", command)).status).toBe("done");
  });

  it("backs off an app's commands after a decline, doubling, and starts again once one is done", async () => {
    const { limits, ask, later } = setUp({ status: "declined", message: "No." });

    expect((await limits.ask("claude", command)).status).toBe("declined");
    expect(await limits.ask("claude", command)).toMatchObject({ status: "busy" });
    // Queries go on: they ask the person nothing.
    expect((await limits.ask("claude", query)).status).toBe("declined");

    later(DECLINED_BACK_OFF_MS.first);
    await limits.ask("claude", command);
    later(DECLINED_BACK_OFF_MS.first);
    expect(await limits.ask("claude", command)).toMatchObject({ status: "busy" });
    later(DECLINED_BACK_OFF_MS.first);

    ask.mockResolvedValue({ status: "done", label: "Added" });
    expect((await limits.ask("claude", command)).status).toBe("done");
    expect((await limits.ask("claude", command)).status).toBe("done");
  });

  it("forgets a removed app's limits", async () => {
    const { limits } = setUp({ status: "declined", message: "No." });
    await limits.ask("claude", command);

    limits.forget("claude");

    expect((await limits.ask("claude", command)).status).toBe("declined");
  });
});
