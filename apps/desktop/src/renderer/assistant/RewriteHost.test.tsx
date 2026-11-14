// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RewriteRequest, TextRewriter } from "@webforge/engine";
import { siteLibrary } from "@webforge/site-components";
import { createFakeEngine } from "@webforge/test-utils/renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftResult } from "../../shared/ipc/assistant.js";
import { starterSite } from "../../shared/starter-site.js";
import { createEditorSession } from "../editor/editor-session.js";
import { createFakeAssistant, FAKE_STATUS, type FakeAssistantOptions } from "./fake-assistant.js";
import { RewriteHost } from "./RewriteHost.js";

afterEach(cleanup);

const SESSION = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";

const REQUEST: RewriteRequest = {
  how: "shorter",
  text: "We are open every single day from nine in the morning.",
  formatted: false,
  at: { nodeId: "text-1", field: "text" },
};

const draftOf = (text: string): DraftResult => ({ status: "ok", texts: [text], costUsd: 0.001 });

function setUp(options: FakeAssistantOptions = {}) {
  const session = createEditorSession(siteLibrary, starterSite());
  const engine = createFakeEngine();
  const api = createFakeAssistant({ delayMs: 0, ...options });
  const draft = vi.spyOn(api, "draft");
  render(<RewriteHost session={session} engine={engine} api={api} sessionId={SESSION} />);
  /** The rewriter the toolbar has now, if any. */
  const rewriter = () =>
    vi.mocked(engine.setTextRewriter).mock.calls.at(-1)?.[0] as TextRewriter | null | undefined;
  /** Asks as the toolbar's Rewrite menu does, once the assistant's status has come. */
  const ask = async (request: RewriteRequest = REQUEST) => {
    await waitFor(() => expect(rewriter()).toBeTypeOf("function"));
    let answer: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      answer = (rewriter() as TextRewriter)(request);
    });
    return answer;
  };
  return { session, engine, api, draft, rewriter, ask, user: userEvent.setup({ delay: null }) };
}

describe("rewriting selected text with the assistant (G25a, #873)", () => {
  it("gives the toolbar a Rewrite menu only while the assistant is on", async () => {
    const { api, rewriter } = setUp({ status: { enabled: false } });
    // The status has come, and the assistant is off: no menu.
    await act(async () => {
      await api.status();
    });
    expect(rewriter()).toBeUndefined();

    act(() => api.emit({ type: "status", status: FAKE_STATUS }));
    await waitFor(() => expect(rewriter()).toBeTypeOf("function"));
    act(() => api.emit({ type: "status", status: { ...FAKE_STATUS, enabled: false } }));
    await waitFor(() => expect(rewriter()).toBeNull());
  });

  it("shows the suggestion beside the text, and uses it only when asked", async () => {
    const { ask, draft, user } = setUp({ draft: draftOf("Open daily from 9am.") });
    const answer = ask();
    const dialog = await screen.findByRole("dialog", { name: "Rewrite Text" });
    await within(dialog).findByText("Open daily from 9am.");
    within(dialog).getByText(REQUEST.text);
    expect(draft).toHaveBeenCalledWith(SESSION, {
      kind: "rewrite",
      how: "shorter",
      text: REQUEST.text,
    });

    await user.click(within(dialog).getByRole("button", { name: "Use This" }));
    expect(await answer).toBe("Open daily from 9am.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves the text as it is on Cancel", async () => {
    const { ask, user } = setUp();
    const answer = ask();
    const dialog = await screen.findByRole("dialog", { name: "Rewrite Text" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await answer).toBeUndefined();
  });

  it("says why there's no suggestion, and Try Again asks again", async () => {
    const answers = [{ status: "no-credit" } as const, draftOf("Open daily.")];
    const { ask, user } = setUp({ draft: () => answers.shift() ?? draftOf("Again.") });
    void ask();
    const dialog = await screen.findByRole("dialog", { name: "Rewrite Text" });
    await within(dialog).findByText("Your OpenRouter account has run out of credit.");
    expect(within(dialog).queryByRole("button", { name: "Use This" })).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "Try Again" }));
    await within(dialog).findByText("Open daily.");
  });

  it("asks this site's question first, and drafts once the person says yes", async () => {
    const { ask, draft, user } = setUp({
      siteConsent: { asked: false, allowed: false },
      draft: draftOf("Open daily."),
    });
    void ask();
    const dialog = await screen.findByRole("dialog", { name: "Rewrite Text" });
    await within(dialog).findByText(/^Use the assistant on /);
    expect(draft).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Use on This Site" }));
    await within(dialog).findByText("Open daily.");
  });

  it("sends nothing for a site the person said no to, or for too much text", async () => {
    const { ask, draft } = setUp({ siteConsent: { asked: true, allowed: false } });
    void ask();
    const dialog = await screen.findByRole("dialog", { name: "Rewrite Text" });
    await within(dialog).findByText("You chose not to use the assistant on this site.");

    expect(draft).not.toHaveBeenCalled();
  });

  it("sends nothing for more text than a draft takes", async () => {
    const { ask, draft } = setUp();
    void ask({ ...REQUEST, text: "x".repeat(4001) });
    const dialog = await screen.findByRole("dialog", { name: "Rewrite Text" });
    await within(dialog).findByText(/^Select less text/);
    expect(draft).not.toHaveBeenCalled();
  });

  it("says formatting isn't kept when the selection had some", async () => {
    const { ask } = setUp({ draft: draftOf("Open daily.") });
    void ask({ ...REQUEST, formatted: true });
    const dialog = await screen.findByRole("dialog", { name: "Rewrite Text" });
    await within(dialog).findByText("Bold, italic, colours and links in this text aren't kept.");
  });
});
