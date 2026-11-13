import { describe, expect, it, vi } from "vitest";
import { createAssistantPanel } from "./assistant-state.js";
import { createFakeAssistant, FAKE_STATUS } from "./fake-assistant.js";

/** Lets the fake's events, sent a tick apart, all arrive. */
const settle = () => vi.waitFor(() => undefined).then(() => new Promise((r) => setTimeout(r, 20)));

describe("the assistant panel's state (6.9c, ADR 0026 §7)", () => {
  it("loads the status, the site's consent and its conversation, then streams a reply in", async () => {
    const api = createFakeAssistant({ delayMs: 0 });
    const panel = createAssistantPanel(api, "site-1");
    await vi.waitFor(() => expect(panel.state.getState().status).toBeDefined());
    expect(panel.state.getState().site).toEqual({ asked: true, allowed: true });

    await panel.send("Say we open on Saturdays", { pageId: "home" });
    expect(panel.state.getState().replying).toBeDefined();
    await vi.waitFor(() => expect(panel.state.getState().replying).toBeUndefined());

    const [turn] = panel.state.getState().turns;
    expect(turn?.message).toBe("Say we open on Saturdays");
    expect(turn?.state).toBe("done");
    expect(turn?.reply).toMatch(/open on Saturdays/);
    expect(turn?.steps.map((step) => step.entryId)).toEqual(["fake-entry-1"]);
    expect(turn?.tools).toEqual([
      expect.objectContaining({ callId: "call-1", state: "done", step: expect.anything() }),
    ]);
    expect(turn?.costUsd).toBe(0.12);
    expect(panel.state.getState().status?.month.spentUsd).toBe(0.12);
    panel.dispose();
  });

  it("follows only this site's replies, and the app's status and limit whichever site", async () => {
    const api = createFakeAssistant({ delayMs: 0 });
    const panel = createAssistantPanel(api, "site-1");
    await vi.waitFor(() => expect(panel.state.getState().status).toBeDefined());

    api.emit({ session: "site-2", type: "reply-started", replyId: "other", model: "m" });
    api.emit({ session: "site-2", type: "text", replyId: "other", delta: "not here" });
    api.emit({ type: "limit", level: "reached", month: { spentUsd: 5.1, limitUsd: 5 } });

    expect(panel.state.getState().turns).toEqual([]);
    expect(panel.state.getState().status?.month).toMatchObject({ spentUsd: 5.1, reached: true });
    api.emit({ type: "status", status: { ...FAKE_STATUS, enabled: false } });
    expect(panel.state.getState().status?.enabled).toBe(false);
    panel.dispose();
  });

  it("says why a message wasn't sent, and sends nothing while a reply is under way", async () => {
    const refusing = createFakeAssistant({ delayMs: 0, reply: { refuse: "consent-needed" } });
    const panel = createAssistantPanel(refusing, "site-1");
    await panel.send("Hello", {});
    expect(panel.state.getState()).toMatchObject({ refused: "consent-needed", turns: [] });
    panel.dispose();

    const api = createFakeAssistant({ delayMs: 5 });
    const send = vi.spyOn(api, "send");
    const busy = createAssistantPanel(api, "site-1");
    await busy.send("First", {});
    await busy.send("Second", {});
    expect(send).toHaveBeenCalledOnce();
    await busy.stop();
    await vi.waitFor(() => expect(busy.state.getState().turns[0]?.stop).toBe("stopped"));
    busy.dispose();
  });

  it("keeps the safety version, ends a failed reply, and forgets the conversation when asked", async () => {
    const api = createFakeAssistant({
      delayMs: 0,
      reply: {
        text: "Working",
        steps: [{ entryId: "e1", label: "AI (Assistant): Edited Hero text" }],
        safetyVersion: { versionId: "v1", label: "Before the assistant's changes" },
        fail: "offline",
      },
    });
    const panel = createAssistantPanel(api, "site-1");
    await panel.send("Hi", {});
    await vi.waitFor(() => expect(panel.state.getState().turns[0]?.state).toBe("failed"));
    await settle();

    expect(panel.state.getState()).toMatchObject({ safetyVersionId: "v1", replying: undefined });
    expect(panel.state.getState().turns[0]).toMatchObject({ error: "offline" });
    await panel.newConversation();
    expect(panel.state.getState()).toMatchObject({ turns: [], safetyVersionId: undefined });
    panel.dispose();
  });

  it("ends a reply it opened on part way with all its words (#993 review)", async () => {
    const api = createFakeAssistant({ delayMs: 5, reply: { text: "one two three four five six" } });
    await api.send("site-1", "Hi", {});
    await new Promise((resolve) => setTimeout(resolve, 12));
    // Opened part way through: main's copy is taken, then words stream before the panel has it.
    const slow = {
      ...api,
      conversation: async (session: string) => {
        const copy = await api.conversation(session);
        await new Promise((resolve) => setTimeout(resolve, 15));
        return copy;
      },
    };
    const panel = createAssistantPanel(slow, "site-1");
    await vi.waitFor(() => expect(panel.state.getState().turns[0]?.state).toBe("done"));
    await vi.waitFor(() =>
      expect(panel.state.getState().turns[0]?.reply).toBe("one two three four five six"),
    );
    panel.dispose();
  });

  it("records this site's answer", async () => {
    const api = createFakeAssistant({ siteConsent: { asked: false, allowed: false } });
    const panel = createAssistantPanel(api, "site-1");
    await vi.waitFor(() =>
      expect(panel.state.getState().site).toEqual({ asked: false, allowed: false }),
    );

    await panel.answerSite(true);
    expect(panel.state.getState().site).toEqual({ asked: true, allowed: true });
    expect(await api.siteConsent("site-1")).toEqual({ asked: true, allowed: true });
    panel.dispose();
  });
});
