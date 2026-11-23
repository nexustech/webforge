// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { createFakeAssistant, FAKE_STATUS, type FakeAssistantOptions } from "./fake-assistant.js";
import { registerAssistantPanel } from "./register-assistant-panel.js";

afterEach(cleanup);

/** The panel on a site, its component drawn as the window would. */
function shown(options: FakeAssistantOptions = {}) {
  const api = createFakeAssistant({ delayMs: 0, ...options });
  const send = vi.spyOn(api, "send");
  const session = sessionWith();
  const openSettings = vi.fn();
  const openCredits = vi.fn();
  const openExamples = vi.fn();
  const show = vi.fn();
  let Panel: () => ReactNode = () => null;
  const { remove, tryExample } = registerAssistantPanel({
    panels: {
      register: (panel) => {
        Panel = panel.component as () => ReactNode;
        return () => undefined;
      },
      show,
    },
    session,
    api,
    sessionId: "site-1",
    openSettings,
    openCredits,
    openExamples,
  });
  render(<Panel />);
  return {
    api,
    send,
    session,
    openSettings,
    openCredits,
    openExamples,
    show,
    remove,
    tryExample,
    user: userEvent.setup({ delay: null }),
  };
}

describe("the assistant's panel (6.9c)", () => {
  it("sends nothing before the site's yes, and nothing after a no (AIA-6)", async () => {
    const { send, user } = shown({ siteConsent: { asked: false, allowed: false } });
    const ask = await screen.findByRole("region", { name: /Use the assistant on/ });

    expect(screen.queryByRole("textbox", { name: "Message the assistant" })).toBeNull();
    await user.click(within(ask).getByRole("button", { name: "Not Now" }));
    expect(await screen.findByText(/chose not to use the assistant on this site/)).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Message the assistant" })).toBeNull();
    expect(send).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Use on This Site" }));
    expect(await screen.findByRole("textbox", { name: "Message the assistant" })).toBeDefined();
  });

  it("stops using the assistant on this site when asked (AIA-6)", async () => {
    const { api, user } = shown();
    const consent = vi.spyOn(api, "setSiteConsent");
    await user.click(await screen.findByRole("button", { name: "Stop Using on This Site" }));

    expect(consent).toHaveBeenCalledWith("site-1", false);
    expect(await screen.findByText(/chose not to use the assistant on this site/)).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Message the assistant" })).toBeNull();
  });

  it("opens a reply's link through main, as the reply wrote it", async () => {
    const { api, user } = shown({
      reply: { text: "See [our hours](HTTPS://Bakery.example/hours)." },
    });
    const open = vi.spyOn(api, "openLink");
    await user.type(
      await screen.findByRole("textbox", { name: "Message the assistant" }),
      "Hi{Enter}",
    );
    await user.click(await screen.findByRole("link", { name: /our hours/ }));

    expect(open).toHaveBeenCalledWith("site-1", expect.any(String), "HTTPS://Bakery.example/hours");
    expect(await open.mock.results[0]?.value).toEqual({ status: "opened" });
  });

  it("puts an example tried in the box, unsent and focused, and shows the panel (5.21)", async () => {
    const { send, show, tryExample, user } = shown();
    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    await user.type(box, "Also this");

    act(() => tryExample("Make the corners rounder."));

    expect(show).toHaveBeenCalledWith("assistant");
    await waitFor(() => expect(document.activeElement).toBe(box));
    // Before what was typed there, which stays.
    expect((box as HTMLTextAreaElement).value).toBe("Make the corners rounder.\n\nAlso this");
    expect(send).not.toHaveBeenCalled();
  });

  it("opens Things You Can Ask from its link (5.21)", async () => {
    const { openExamples, user } = shown();
    await user.click(await screen.findByRole("button", { name: "Things You Can Ask…" }));
    expect(openExamples).toHaveBeenCalledOnce();
  });

  it("keeps an example tried before it's set up behind what it asks first (5.21)", async () => {
    const { show, tryExample } = shown({
      status: { ...FAKE_STATUS, enabled: false, consentVersion: null },
    });
    await screen.findByRole("button", { name: "Set Up the Assistant…" });

    act(() => tryExample("Make the corners rounder."));

    expect(show).toHaveBeenCalledWith("assistant");
    expect(screen.queryByRole("textbox", { name: "Message the assistant" })).toBeNull();
    expect(screen.getByRole("button", { name: "Set Up the Assistant…" })).toBeDefined();
  });

  it("is off until set up in Settings, and asks again when its provider is new", async () => {
    const off = shown({ status: { ...FAKE_STATUS, enabled: false, consentVersion: null } });
    await off.user.click(await screen.findByRole("button", { name: "Set Up the Assistant…" }));
    expect(off.openSettings).toHaveBeenCalledOnce();
    cleanup();

    const moved = shown({
      status: {
        ...FAKE_STATUS,
        enabled: false,
        provider: { kind: "server", baseUrl: "https://ai.example.org/v1", hasKey: true },
        reach: "server",
      },
    });
    const enable = vi.spyOn(moved.api, "setEnabled");
    const consent = within(await screen.findByRole("dialog", { name: "Turn On the Assistant?" }));
    expect(consent.getByText(/server at ai.example.org/)).toBeDefined();
    await moved.user.click(consent.getByRole("button", { name: "Turn On" }));
    expect(enable).toHaveBeenCalledWith(true, FAKE_STATUS.consentVersion);
  });

  it("sends a message with what's selected, and undoes its changes from the review card", async () => {
    const options: FakeAssistantOptions = {
      reply: () => ({
        text: "Done.",
        steps: [{ entryId: entry, label: "AI (Assistant): Edited Hero text" }],
      }),
    };
    let entry = "";
    const { send, session, user } = shown(options);
    session.history.run("AI (Assistant): Edited Hero text", (site) => {
      site.settings.general.name = "Changed";
    });
    entry = session.history.entries()[0]?.id ?? "";

    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    await user.type(box, "Shorten the title{Enter}");
    expect(send).toHaveBeenCalledWith("site-1", "Shorten the title", {
      pageId: session.ui.getState().pageId,
    });
    const card = within(await screen.findByRole("region", { name: "This reply made 1 change" }));

    await user.click(card.getByRole("button", { name: "Undo These Changes" }));
    await waitFor(() => expect(session.history.state.getState().cursor).toBe(0));
    expect(card.getByRole("status").textContent).toMatch(/These changes are undone/);
  });

  it("says why a message wasn't sent, and keeps it to send again (#1000 review)", async () => {
    const { user } = shown({ reply: { refuse: "limit-reached" } });
    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    await user.type(box, "Hi{Enter}");

    expect((await screen.findByRole("alert")).textContent).toMatch(/This month's limit is reached/);
    expect((box as HTMLTextAreaElement).value).toBe("Hi");
  });

  it("sends nothing on the Enter that confirms a composed word (#1000 review)", async () => {
    const { send } = shown();
    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    fireEvent.change(box, { target: { value: "日本" } });
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    fireEvent.keyDown(box, { key: "Enter", keyCode: 229 });

    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(send).toHaveBeenCalledOnce();
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(""));
  });
});

describe("what the person can do about an error (5.20, OL-5)", () => {
  /** Sends `text` from the box. */
  async function sent(user: ReturnType<typeof userEvent.setup>, text: string) {
    await user.type(
      await screen.findByRole("textbox", { name: "Message the assistant" }),
      `${text}{Enter}`,
    );
  }

  it("sends a failed reply's message again with Try Again, from the last reply only", async () => {
    const { send, user } = shown({ reply: { text: "Working on it", fail: "offline" } });
    await sent(user, "Say we open on Saturdays");
    await user.click(await screen.findByRole("button", { name: "Try Again" }));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls.map((call) => call[1])).toEqual([
      "Say we open on Saturdays",
      "Say we open on Saturdays",
    ]);
    // The second failed too: one Try Again, under it, none under the first.
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(screen.getAllByRole("button", { name: "Try Again" })).toHaveLength(1);
  });

  it("opens Assistant Settings for a refusal it can fix there, keeping the message", async () => {
    const { openSettings, user } = shown({ reply: { refuse: "not-signed-in" } });
    await sent(user, "Hi");
    await user.click(await screen.findByRole("button", { name: "Assistant Settings…" }));

    expect(openSettings).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
  });

  it("sends a refused message again with Try Again, from the box", async () => {
    const { send, user } = shown({ reply: { refuse: "failed" } });
    await sent(user, "Hi");
    await user.click(await screen.findByRole("button", { name: "Try Again" }));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1]?.[1]).toBe("Hi");
  });

  it("opens OpenRouter's page for credit when its account has run out", async () => {
    const { openCredits, user } = shown({ reply: { fail: "no-credit" } });
    await sent(user, "Hi");
    await user.click(await screen.findByRole("button", { name: "Add Credit on OpenRouter" }));

    expect(openCredits).toHaveBeenCalledOnce();
  });

  it("words another server's out of credit as its own, with no OpenRouter button", async () => {
    const { user } = shown({
      reply: { fail: "no-credit" },
      status: { provider: { kind: "server", baseUrl: "https://ai.example.com/v1", hasKey: true } },
    });
    await sent(user, "Hi");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The server says your account has run out of credit.",
    );
    expect(screen.queryByRole("button", { name: "Add Credit on OpenRouter" })).toBeNull();
  });

  it("offers nothing where the panel already does: busy has its Stop", async () => {
    const { user } = shown({ reply: { refuse: "busy" } });
    await sent(user, "Hi");

    expect((await screen.findByRole("alert")).textContent).toMatch(/still replying/);
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Assistant Settings…" })).toBeNull();
  });
});

describe("a message typed while a reply runs (5.19, OL-4)", () => {
  it("is held above the box, sent when the reply finishes, and can be taken back or removed", async () => {
    const { send, user } = shown({ delayMs: 30 });
    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    await user.type(box, "Say we open on Saturdays{Enter}");
    await screen.findByRole("button", { name: "Stop" });

    // Typed during the reply: held, not sent, and the box is free again.
    await user.type(box, "And on Sundays");
    await user.click(screen.getByRole("button", { name: "Send After This Reply" }));
    const waiting = screen.getByRole("region", { name: "Message waiting to send" });
    expect(within(waiting).getByText("And on Sundays")).toBeDefined();
    expect((box as HTMLTextAreaElement).value).toBe("");

    // Taken back to edit: in the box, no longer waiting.
    await user.click(within(waiting).getByRole("button", { name: "Edit" }));
    expect((box as HTMLTextAreaElement).value).toBe("And on Sundays");
    expect(screen.queryByRole("region", { name: "Message waiting to send" })).toBeNull();

    // Held again, and sent by itself once the reply has finished.
    await user.click(screen.getByRole("button", { name: "Send After This Reply" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(send).toHaveBeenLastCalledWith("site-1", "And on Sundays", expect.anything());
  });
});

describe("a question before acting (5.16, OL-1)", () => {
  const ASKING: FakeAssistantOptions["reply"] = {
    text: "Before I change anything:",
    question: {
      question: "Which look would you like?",
      answers: ["Calm and modern", "Bold and bright", "Classic"],
    },
    steps: [
      {
        entryId: "fake-entry-1",
        label: "AI (Assistant): Edited theme",
        target: { pageId: "home" },
      },
    ],
  };

  it("asks with one-tap answers, the recommended one first, and goes on with the one chosen", async () => {
    const { api, user } = shown({ reply: ASKING });
    const answer = vi.spyOn(api, "answer");
    await user.type(
      await screen.findByRole("textbox", { name: "Message the assistant" }),
      "Make it look more professional{Enter}",
    );

    const card = await screen.findByRole("region", { name: /The assistant asks/ });
    expect(within(card).getByText("Which look would you like?")).toBeDefined();
    // Said once to a screen reader, outside the conversation, which is busy while it runs.
    expect(screen.getByRole("status", { name: "" }).textContent).toBe(
      "The assistant asks: Which look would you like?",
    );
    const answers = within(card).getAllByRole("button");
    expect(answers.map((button) => button.textContent)).toEqual([
      "Calm and modernRecommended",
      "Bold and bright",
      "Classic",
    ]);
    // Nothing changes while it waits.
    expect(screen.queryByRole("list", { name: "Changes" })).toBeNull();

    await user.type(
      within(card).getByRole("textbox", { name: "Add a note (optional)" }),
      "Keep the logo",
    );
    await user.click(answers[1] as HTMLElement);

    expect(answer).toHaveBeenCalledWith("site-1", expect.any(String), "question-1", {
      answer: "Bold and bright",
      note: "Keep the logo",
    });
    // The same reply goes on, and the card keeps the answer given.
    expect(await screen.findByText("This reply made 1 change")).toBeDefined();
    expect(within(card).getByText("Bold and bright")).toBeDefined();
    expect(within(card).getByText("Keep the logo")).toBeDefined();
    expect(within(card).queryByRole("button")).toBeNull();
  });

  it("takes a message typed in the box as the answer, and works by keyboard alone", async () => {
    const { api, send, user } = shown({ reply: ASKING });
    const answer = vi.spyOn(api, "answer");
    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    await user.type(box, "Make it look more professional{Enter}");
    const card = await screen.findByRole("region", { name: /The assistant asks/ });

    expect(screen.getByRole("button", { name: "Send as Your Answer" })).toBeDefined();
    // A note written on the card goes with the answer typed in the box (PR 1332's review).
    await user.type(
      within(card).getByRole("textbox", { name: "Add a note (optional)" }),
      "Keep the logo",
    );
    await user.type(box, "Something friendly, with green{Enter}");

    expect(answer).toHaveBeenCalledWith("site-1", expect.any(String), "question-1", {
      answer: "Something friendly, with green",
      note: "Keep the logo",
    });
    expect(send).toHaveBeenCalledOnce();
    await screen.findByText("This reply made 1 change");
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("chooses an answer from the keyboard: Tab between the answers and the note, then Enter", async () => {
    const { api, user } = shown({ reply: ASKING });
    const answer = vi.spyOn(api, "answer");
    await user.type(
      await screen.findByRole("textbox", { name: "Message the assistant" }),
      "Make it look more professional{Enter}",
    );
    const card = await screen.findByRole("region", { name: /The assistant asks/ });
    const [recommended, , classic] = within(card).getAllByRole("button");
    const note = within(card).getByRole("textbox", { name: "Add a note (optional)" });
    recommended?.focus();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(classic);
    await user.tab();
    expect(document.activeElement).toBe(note);
    await user.keyboard("Plain fonts");
    await user.tab({ shift: true });
    await user.keyboard("{Enter}");

    expect(answer).toHaveBeenCalledWith("site-1", expect.any(String), "question-1", {
      answer: "Classic",
      note: "Plain fonts",
    });
  });

  it("says a question wasn't answered once Stop ends the reply", async () => {
    const { user } = shown({ reply: ASKING });
    await user.type(
      await screen.findByRole("textbox", { name: "Message the assistant" }),
      "Make it look more professional{Enter}",
    );
    const card = await screen.findByRole("region", { name: /The assistant asks/ });
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(await within(card).findByText("Not answered.")).toBeDefined();
    expect(within(card).queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeDefined();
  });
});
