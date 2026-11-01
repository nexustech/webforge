import { createCommandApi } from "@webforge/commands";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createEditorSession, textSessionKey } from "../editor/editor-session.js";
import { createSiteWideConfirm } from "../shell/confirm-site-wide.js";
import { answerRequest, commandHost } from "./command-host.js";

function setup(mode: "design" | "content" = "design") {
  const session = createEditorSession(siteLibrary, starterSite());
  const siteWide = createSiteWideConfirm();
  const host = commandHost(session, { getState: () => ({ mode }) as never }, siteWide);
  return { session, siteWide, host, api: createCommandApi(host) };
}

const confirmation = {
  action: "Allow Claude to change the theme?",
  confirm: "Allow",
  affectedPages: 3,
};

describe("commandHost (4.8)", () => {
  it("runs a command as the session's own edit, of its kind", () => {
    const { session, host } = setup();
    const added = vi.fn();
    session.onEntryAdded(added);
    host.run(
      "AI (Claude): Deleted Hero",
      (draft) => {
        draft.settings.general.name = "Rosa's";
      },
      "remove",
    );
    expect(session.history.document.getState().settings.general.name).toBe("Rosa's");
    expect(added).toHaveBeenCalledWith(
      expect.objectContaining({ label: "AI (Claude): Deleted Hero" }),
      "remove",
    );
  });

  it("is editing while the person types in a text, or answers a question of their own", () => {
    const { session, siteWide, host } = setup("content");
    expect(host.editing()).toBe(false);
    expect(host.mode()).toBe("content");

    const pageId = session.ui.getState().pageId;
    session.edit(
      "text",
      "Edited Heading text",
      (draft) => {
        draft.settings.general.name = "Typing";
      },
      { coalesceKey: textSessionKey(pageId, "heading", "text") },
    );
    expect(host.editing()).toBe(true);
    session.history.endSession(textSessionKey(pageId, "heading", "text"));
    expect(host.editing()).toBe(false);

    void siteWide.confirmSiteWide({ action: "Delete page?", confirm: "Delete", affectedPages: 2 });
    expect(host.editing()).toBe(true);
    siteWide.answer(false);
    expect(host.editing()).toBe(false);

    // A dialog changing the site live holds others' changes until it is done (3.13a).
    const release = session.hold();
    expect(host.editing()).toBe(true);
    release();
    release();
    expect(host.editing()).toBe(false);
  });

  it("asks in the window's site-wide question, and closes it when the time is up", async () => {
    const { siteWide, host } = setup();
    const allowed = host.confirm(confirmation, new AbortController().signal);
    expect(siteWide.current()).toEqual(confirmation);
    siteWide.answer(true);
    expect(await allowed).toBe(true);
    // Where a payment link goes now and would go is the question's description (S18).
    const repointed = {
      ...confirmation,
      description: "Payment link: from a.example to b.example.",
    };
    void host.confirm(repointed, new AbortController().signal);
    expect(siteWide.current()?.description).toBe(repointed.description);
    siteWide.answer(false);

    const timeout = new AbortController();
    const unanswered = host.confirm(confirmation, timeout.signal);
    timeout.abort();
    expect(await unanswered).toBe(false);
    expect(siteWide.current()).toBeNull();
  });

  it("leaves a question asked since alone when an earlier one's time is up", async () => {
    const { siteWide, host } = setup();
    const timeout = new AbortController();
    const first = host.confirm(confirmation, timeout.signal);
    const theirs = { action: "Delete page?", confirm: "Delete", affectedPages: 2 };
    void siteWide.confirmSiteWide(theirs);
    expect(await first).toBe(false);
    timeout.abort();
    expect(siteWide.current()).toBe(theirs);
  });
});

describe("answerRequest (4.8)", () => {
  it("answers a query and a command for the app that asked", async () => {
    const { api, session } = setup();
    const outline = await answerRequest(api, { kind: "query", name: "outline", input: {} });
    expect(outline).toMatchObject({ status: "done", data: { name: "My site" } });
    const page = await answerRequest(api, {
      kind: "command",
      name: "addPage",
      input: { title: "Menu" },
      app: "Claude",
    });
    expect(page).toMatchObject({ status: "done", label: "AI (Claude): Added page 'Menu'" });
    expect(session.history.state.getState().entries.at(-1)?.label).toBe(
      "AI (Claude): Added page 'Menu'",
    );
  });
});
