import { describe, expect, it } from "vitest";
import { type AssistantEvent, assistantEvents } from "../../shared/ipc/assistant.js";
import { createFakeAssistant, FAKE_MODEL, FAKE_STATUS } from "./fake-assistant.js";

const SESSION = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";

/** The fake's events, until `until` is one of them. */
function recorder(fake: ReturnType<typeof createFakeAssistant>) {
  const events: AssistantEvent[] = [];
  const ended = new Promise<void>((resolve) => {
    fake.onEvent((event) => {
      events.push(event);
      if (event.type === "reply-done" || event.type === "reply-failed") resolve();
    });
  });
  return { events, ended };
}

describe("the stand-in assistant (ADR 0026 §7)", () => {
  it("answers as main does: started, text, a tool step, then done with the cost and card", async () => {
    const fake = createFakeAssistant({ delayMs: 0 });
    const { events, ended } = recorder(fake);

    const sent = await fake.send(SESSION, "Say we open on Saturdays", {});
    expect(sent.status).toBe("sending");
    await ended;

    // Every event is one the preload would let through.
    for (const event of events) {
      expect(assistantEvents.event.args.safeParse([event]).success).toBe(true);
    }
    const types = events.map((event) => event.type);
    expect(types[0]).toBe("reply-started");
    expect(types.at(-1)).toBe("reply-done");
    expect(types).toContain("text");
    const tools = events.filter((event) => event.type === "tool");
    expect(tools.map((event) => event.state)).toEqual(["running", "done"]);
    const done = events.at(-1);
    expect(done).toMatchObject({
      type: "reply-done",
      stop: "end",
      costUsd: 0.12,
      steps: [{ label: "AI (Assistant): Edited Hero text" }],
    });
    const [turn] = await fake.conversation(SESSION);
    expect(turn).toMatchObject({ state: "done", message: "Say we open on Saturdays" });
    expect(turn?.reply).toBe(
      events.flatMap((event) => (event.type === "text" ? [event.delta] : [])).join(""),
    );
  });

  it("refuses a message as main would, and fails a reply part way when told to", async () => {
    const refusing = createFakeAssistant({ reply: { refuse: "limit-reached" } });
    expect(await refusing.send(SESSION, "Hello", {})).toEqual({ status: "limit-reached" });

    const failing = createFakeAssistant({
      delayMs: 0,
      reply: { text: "Working", fail: "offline" },
    });
    const { events, ended } = recorder(failing);
    await failing.send(SESSION, "Hello", {});
    await ended;
    expect(events.at(-1)).toMatchObject({ type: "reply-failed", error: "offline" });
  });

  it("stops a reply, and takes another message for the site once it has", async () => {
    const fake = createFakeAssistant({
      delayMs: 5,
      reply: { text: "one two three four five six" },
    });
    const { events, ended } = recorder(fake);
    const sent = await fake.send(SESSION, "Hello", {});
    if (sent.status !== "sending") throw new Error("not sent");
    expect(await fake.send(SESSION, "Again", {})).toEqual({ status: "busy" });

    await fake.stop(sent.replyId);
    await ended;
    expect(events.at(-1)).toMatchObject({ type: "reply-done", stop: "stopped" });
    expect((await fake.send(SESSION, "Again", {})).status).toBe("sending");
  });

  it("warns once the month's spend passes 80% of the limit", async () => {
    const fake = createFakeAssistant({
      delayMs: 0,
      status: { month: { spentUsd: 3.9, limitUsd: 5, warned: false, reached: false } },
    });
    const { events, ended } = recorder(fake);
    await fake.send(SESSION, "Hello", {});
    await ended;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events.find((event) => event.type === "limit")).toMatchObject({ level: "warning" });
  });

  it("starts signed in, with a tested model and nothing spent, and lists that model", async () => {
    const fake = createFakeAssistant();
    expect(await fake.status()).toEqual(FAKE_STATUS);
    expect(await fake.models()).toEqual({ status: "ok", models: [FAKE_MODEL] });
  });

  it("sends only events the preload lets through: a reply's, the limit's and the status's", async () => {
    const fake = createFakeAssistant({
      delayMs: 0,
      status: { month: { spentUsd: 4.5, limitUsd: 5, warned: true, reached: false } },
      reply: {
        text: "Done.",
        steps: [{ entryId: "e1", label: "AI (Assistant): Edited Hero text" }],
        safetyVersion: { versionId: "v1", label: "Before the assistant's changes" },
        links: [{ host: "example.com", href: "https://example.com/" }],
        costUsd: 1,
      },
    });
    const { events, ended } = recorder(fake);
    await fake.setEnabled(true, 1);
    await fake.update({ monthlyLimitUsd: 6 });
    await fake.update({ monthlyLimitUsd: 5 });
    await fake.signIn("browser");
    await fake.send(SESSION, "Hello", {});
    await ended;
    await fake.setEnabled(false, 1);

    const types = new Set(events.map((event) => event.type));
    for (const type of [
      "status",
      "reply-started",
      "text",
      "tool",
      "safety-version",
      "reply-done",
      "limit",
    ]) {
      expect(types).toContain(type);
    }
    expect(events.find((event) => event.type === "limit")).toMatchObject({ level: "reached" });
    for (const event of events) {
      expect(assistantEvents.event.args.safeParse([event]).success).toBe(true);
    }
    // The app's events name no site.
    for (const event of events.filter((each) => each.type === "status" || each.type === "limit")) {
      expect(event).not.toHaveProperty("session");
    }
  });
});
