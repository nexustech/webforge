// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftRequest } from "../../shared/ipc/assistant.js";
import { starterSite } from "../../shared/starter-site.js";
import { createEditorSession } from "../editor/editor-session.js";
import { BusinessDraftHost } from "./BusinessDraftHost.js";
import { createFakeAssistant, type FakeAssistantOptions } from "./fake-assistant.js";

afterEach(cleanup);

const SESSION = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";
const ABOUT = "Sourdough and rye, baked in Leeds since 1990.";

function setUp(options: FakeAssistantOptions = {}, about: string | null = ABOUT) {
  const session = createEditorSession(siteLibrary, starterSite({ name: "Rise Bakery" }));
  const asked: DraftRequest[] = [];
  const api = createFakeAssistant({
    delayMs: 0,
    draft: (request) => {
      asked.push(request);
      return { status: "ok", texts: ["Bread worth the walk", "Baked every morning."], costUsd: 0 };
    },
    ...options,
  });
  const takeAbout = vi.fn(async () => about);
  render(
    <BusinessDraftHost session={session} api={api} takeAbout={takeAbout} sessionId={SESSION} />,
  );
  return { session, api, asked, takeAbout, user: userEvent.setup({ delay: null }) };
}

const heading = (session: ReturnType<typeof setUp>["session"]) => {
  const site = session.history.document.getState();
  const content = site.pages[site.homePageId]?.doc.content[0]?.props.content;
  return Array.isArray(content) ? content.map((node) => node.props.text) : [];
};

describe("the quick start's business step, once the site opens (QS-7, #873)", () => {
  it("drafts the pages' words from the paragraph, for the person to change and use", async () => {
    const { session, asked, takeAbout, user } = setUp();
    const dialog = await screen.findByRole("dialog", { name: "Words for Your Pages" });
    const boxes = await within(dialog).findAllByRole("textbox");
    expect(takeAbout).toHaveBeenCalledWith(SESSION);
    expect(asked[0]).toMatchObject({ kind: "business", business: { about: ABOUT } });
    expect(boxes.map((box) => (box as HTMLTextAreaElement).value)).toEqual([
      "Bread worth the walk",
      "Baked every morning.",
    ]);

    await user.clear(boxes[0] as HTMLElement);
    await user.type(boxes[0] as HTMLElement, "Rise and shine");
    await user.click(within(dialog).getByRole("button", { name: "Use These" }));

    expect(heading(session)).toEqual(["Rise and shine", "<p>Baked every morning.</p>"]);
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "AI (Assistant): Wrote the home and About pages' words",
    ]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks this site's question in place first", async () => {
    const { user } = setUp({ siteConsent: { asked: false, allowed: false } });
    const dialog = await screen.findByRole("dialog", { name: "Words for Your Pages" });
    await user.click(await within(dialog).findByRole("button", { name: "Use on This Site" }));
    expect(await within(dialog).findAllByRole("textbox")).toHaveLength(2);
  });

  it("keeps the template's words on Cancel, and says why there's no draft", async () => {
    const { session, user } = setUp({ draft: { status: "limit-reached" } });
    const dialog = await screen.findByRole("dialog", { name: "Words for Your Pages" });
    await within(dialog).findByRole("alert");
    expect(within(dialog).queryByRole("button", { name: "Use These" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Keep the Template's Words" }));
    expect(session.history.entries()).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows nothing without a paragraph, or while the assistant is off", async () => {
    const without = setUp({}, null);
    await vi.waitFor(() => expect(without.takeAbout).toHaveBeenCalled());
    cleanup();
    const off = setUp({ status: { enabled: false } });
    await vi.waitFor(() => expect(off.takeAbout).toHaveBeenCalled());
    await off.api.status();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(off.asked).toEqual([]);
  });
});
