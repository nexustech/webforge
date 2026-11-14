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

  it("finds the safety version in a conversation it loads, and opens only a reply's own links", async () => {
    const api = createFakeAssistant({
      delayMs: 0,
      reply: {
        text: "See [our hours](https://bakery.example/hours).",
        steps: [{ entryId: "e1", label: "AI (Assistant): Edited Hero text" }],
        safetyVersion: { versionId: "v1", label: "Before the assistant's changes" },
      },
    });
    const sent = await api.send("site-1", "Hi", {});
    await settle();
    const panel = createAssistantPanel(api, "site-1");
    await vi.waitFor(() => expect(panel.state.getState().safetyVersionId).toBe("v1"));
    const replyId = sent.status === "sending" ? sent.replyId : "";

    expect(await panel.openLink(replyId, "https://bakery.example/hours")).toBe("opened");
    expect(await panel.openLink(replyId, "https://evil.example/")).toBe("refused");
    vi.spyOn(api, "openLink").mockRejectedValueOnce(new Error("gone"));
    const again = createAssistantPanel(api, "site-1");
    expect(await again.openLink(replyId, "https://bakery.example/hours")).toBe("failed");
    panel.dispose();
    again.dispose();
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

  it("says a message main couldn't take failed, and logs nothing of it unhandled", async () => {
    const api = createFakeAssistant({ delayMs: 0 });
    const panel = createAssistantPanel(
      { ...api, send: () => Promise.reject(new Error("IPC")) },
      "site-1",
    );
    await panel.send("Hi", {});

    expect(panel.state.getState()).toMatchObject({
      refused: "failed",
      turns: [],
      replying: undefined,
    });
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

describe("held changes in the panel (6.9e, Review before applying)", () => {
  const REPLY = "8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d";
  const NEXT = "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e";
  const MONTH = { spentUsd: 0.1, limitUsd: 5 };
  const held = [{ label: "AI (Assistant): Edited Hero text", target: { pageId: "home" } }];

  /** A panel with reply `replyId` ended, holding `held`. */
  const holding = async (replyId: string) => {
    const api = createFakeAssistant({ delayMs: 0 });
    const panel = createAssistantPanel(api, "site-1");
    await vi.waitFor(() => expect(panel.state.getState().status).toBeDefined());
    api.emit({ session: "site-1", type: "reply-started", replyId, model: "m" });
    api.emit({
      session: "site-1",
      type: "reply-done",
      replyId,
      stop: "end",
      costUsd: 0.1,
      month: MONTH,
      steps: [],
      links: [],
      held,
    });
    return { api, panel };
  };
  const turnOf = (panel: ReturnType<typeof createAssistantPanel>, replyId: string) =>
    panel.state.getState().turns.find((each) => each.replyId === replyId);

  it("holds a reply's changes, then takes its steps and the refused ones once applied", async () => {
    const { api, panel } = await holding(REPLY);
    expect(turnOf(panel, REPLY)?.held).toEqual(held);
    const applied = vi.spyOn(api, "applyHeld").mockResolvedValue({ status: "applied" });
    await panel.applyHeld(REPLY);
    expect(applied).toHaveBeenCalledWith("site-1", REPLY);
    expect(panel.state.getState().applying).toBe(REPLY);
    api.emit({
      session: "site-1",
      type: "held",
      replyId: REPLY,
      state: "applied",
      steps: [{ entryId: "e1", label: "AI (Assistant): Edited Hero text" }],
      refused: [{ label: "AI (Assistant): Removed Text" }],
    });
    expect(turnOf(panel, REPLY)).toMatchObject({
      held: [],
      steps: [{ entryId: "e1" }],
      refused: [{ label: "AI (Assistant): Removed Text" }],
    });
    expect(panel.state.getState().applying).toBeUndefined();
    panel.dispose();
  });

  it("says held changes were discarded, or dropped for a new message", async () => {
    const { api, panel } = await holding(REPLY);
    await panel.discardHeld(REPLY);
    api.emit({
      session: "site-1",
      type: "held",
      replyId: REPLY,
      state: "discarded",
      steps: [],
      refused: [],
    });
    expect(turnOf(panel, REPLY)).toMatchObject({ held: [], heldOutcome: "discarded" });

    // Main drops them itself when a newer reply's held changes replace them.
    const dropped = await holding(NEXT);
    dropped.api.emit({
      session: "site-1",
      type: "held",
      replyId: NEXT,
      state: "discarded",
      steps: [],
      refused: [],
    });
    expect(turnOf(dropped.panel, NEXT)).toMatchObject({ held: [], heldOutcome: "replaced" });
    panel.dispose();
    dropped.panel.dispose();
  });

  it("settles held changes main no longer has, so Apply doesn't do nothing (#1063's review)", async () => {
    const { api, panel } = await holding(REPLY);
    vi.spyOn(api, "applyHeld").mockResolvedValue({ status: "nothing-held" });
    await panel.applyHeld(REPLY);
    expect(turnOf(panel, REPLY)).toMatchObject({ held: [], heldOutcome: "unavailable" });
    expect(panel.state.getState().applying).toBeUndefined();
    panel.dispose();
  });

  it("says nothing of main's discard for a turn that holds nothing, as after the site was reopened (#1063)", async () => {
    const api = createFakeAssistant({ delayMs: 0 });
    const panel = createAssistantPanel(api, "site-1");
    await vi.waitFor(() => expect(panel.state.getState().status).toBeDefined());
    // The reopened panel loaded the reply with nothing held: main had dropped them already.
    api.emit({ session: "site-1", type: "reply-started", replyId: REPLY, model: "m" });
    api.emit({
      session: "site-1",
      type: "reply-done",
      replyId: REPLY,
      stop: "end",
      costUsd: 0.1,
      month: MONTH,
      steps: [],
      links: [],
    });
    api.emit({
      session: "site-1",
      type: "held",
      replyId: REPLY,
      state: "discarded",
      steps: [],
      refused: [],
    });
    expect(turnOf(panel, REPLY)?.heldOutcome).toBeUndefined();
    expect(turnOf(panel, REPLY)?.held).toEqual([]);
    panel.dispose();
  });

  it("leaves held changes waiting when main can't apply them now", async () => {
    const { api, panel } = await holding(REPLY);
    vi.spyOn(api, "applyHeld").mockResolvedValue({ status: "busy" });
    await panel.applyHeld(REPLY);
    expect(panel.state.getState().applying).toBeUndefined();
    expect(turnOf(panel, REPLY)?.held).toEqual(held);
    panel.dispose();
  });
});
