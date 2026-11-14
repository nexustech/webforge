// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Finding } from "@webforge/site-check";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createFakeAssistant, type FakeAssistantOptions } from "../assistant/fake-assistant.js";
import { createEditorSession, type EditorSession } from "../editor/editor-session.js";
import { type SiteCheckAssistant, useAssistantWrites } from "./assistant-writes.js";

afterEach(cleanup);

const SESSION = "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5";

/** One finding's *Write One…*, as the panel draws it, and the dialog. */
function WriteOne({
  session,
  assistant,
  finding,
}: {
  readonly session: EditorSession;
  readonly assistant: SiteCheckAssistant;
  readonly finding: Finding;
}) {
  const writes = useAssistantWrites(session, assistant);
  const write = writes.writeFor("pageDescriptions", finding);
  return (
    <>
      {write === undefined ? null : (
        <button type="button" onClick={write}>
          Write One…
        </button>
      )}
      {writes.dialog}
    </>
  );
}

function setUp(options: FakeAssistantOptions = {}) {
  const session = createEditorSession(siteLibrary, starterSite({ name: "Rise Bakery" }));
  const home = session.history.document.getState().homePageId;
  const api = createFakeAssistant({ delayMs: 0, ...options });
  render(
    <WriteOne
      session={session}
      assistant={{ api, sessionId: SESSION }}
      finding={{ key: home, place: { kind: "page", pageId: home } }}
    />,
  );
  return { session, home, api, user: userEvent.setup({ delay: null }) };
}

describe("Site Check's Write One… (#873)", () => {
  it("isn't there while the assistant is off", async () => {
    const { api } = setUp({ status: { enabled: false } });
    await api.status();
    expect(screen.queryByRole("button", { name: "Write One…" })).toBeNull();
  });

  it("drafts a description, shown as a search result, for the person to change and use", async () => {
    const { session, home, user } = setUp({
      draft: { status: "ok", texts: ["Sourdough baked daily in Leeds."], costUsd: 0.001 },
    });
    await user.click(await screen.findByRole("button", { name: "Write One…" }));
    const dialog = await screen.findByRole("dialog", { name: "Write a Description" });
    const box = await within(dialog).findByRole("textbox", { name: "Description" });
    expect(box).toHaveProperty("value", "Sourdough baked daily in Leeds.");
    within(dialog).getAllByText("Sourdough baked daily in Leeds.", { exact: false });

    await user.clear(box);
    await user.type(box, "Sourdough and rye, baked daily.");
    await user.click(within(dialog).getByRole("button", { name: "Use This" }));

    const site = session.history.document.getState();
    expect(site.pages[home]?.settings.description).toBe("Sourdough and rye, baked daily.");
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "AI (Assistant): Wrote the description of Rise Bakery",
    ]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("changes nothing on Cancel, and says why there's no draft", async () => {
    const { session, user } = setUp({ draft: { status: "limit-reached" } });
    await user.click(await screen.findByRole("button", { name: "Write One…" }));
    const dialog = await screen.findByRole("dialog", { name: "Write a Description" });
    await within(dialog).findByRole("alert");
    expect(within(dialog).queryByRole("button", { name: "Use This" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(session.history.entries()).toEqual([]);
  });

  it("asks this site's question first", async () => {
    const { user } = setUp({
      siteConsent: { asked: false, allowed: false },
      draft: { status: "ok", texts: ["Fresh bread."], costUsd: null },
    });
    await user.click(await screen.findByRole("button", { name: "Write One…" }));
    const dialog = await screen.findByRole("dialog", { name: "Write a Description" });
    await user.click(await within(dialog).findByRole("button", { name: "Use on This Site" }));
    expect(await within(dialog).findByRole("textbox", { name: "Description" })).toHaveProperty(
      "value",
      "Fresh bread.",
    );
  });
});
