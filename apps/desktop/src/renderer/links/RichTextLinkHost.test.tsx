// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LinkPicker } from "@webforge/engine";
import type { RichTextLink } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorSession, currentPage } from "../editor/editor-session.js";
import { createFakeEngine } from "../editor/fake-engine.test-helper.js";
import { starterSite } from "../editor/starter-site.js";
import { RichTextLinkHost } from "./RichTextLinkHost.js";

afterEach(cleanup);

function setUp() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push({
    type: "Section",
    props: { id: "times", layerName: "Opening times", content: [] },
  });
  const session = createEditorSession(siteLibrary, site);
  // The starter text is being edited.
  session.ui.setState({ nodeId: "text-1" });
  const engine = createFakeEngine();
  render(<RichTextLinkHost session={session} engine={engine} />);
  const picker = engine.setLinkPicker.mock.calls.at(-1)?.[0] as LinkPicker;
  /** Asks for a link as the format toolbar does, and returns its answer, once it comes. */
  const ask = (current: RichTextLink | null) => {
    let answer: Promise<RichTextLink | null | undefined> = Promise.resolve(undefined);
    act(() => {
      answer = picker(current);
    });
    return answer;
  };
  return { session, engine, ask, user: userEvent.setup() };
}

describe("RichTextLinkHost (F-ED-3, F-ED-18)", () => {
  it("answers the toolbar with the link made in the dialog, a new tab and all", async () => {
    const { ask, user } = setUp();

    const answer = ask(null);
    const dialog = within(await screen.findByRole("dialog", { name: "Link" }));
    await user.click(dialog.getByRole("radio", { name: "Web address" }));
    await user.type(dialog.getByRole("textbox", { name: "Web address" }), "example.com");
    await user.click(dialog.getByRole("checkbox", { name: "Open in a new tab" }));
    await user.click(dialog.getByRole("button", { name: "Save Link" }));

    await expect(answer).resolves.toEqual({ href: "https://example.com", newTab: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts from the link at the caret, and leaves it as it is when cancelled", async () => {
    const { ask, user } = setUp();

    const answer = ask({ href: "mailto:rosa@example.com", newTab: false });
    const dialog = within(await screen.findByRole("dialog", { name: "Link" }));
    expect((dialog.getByRole("textbox", { name: "Email address" }) as HTMLInputElement).value).toBe(
      "rosa@example.com",
    );
    await user.click(dialog.getByRole("button", { name: "Cancel" }));

    await expect(answer).resolves.toBeUndefined();
  });

  it("gives a section linked to for the first time its anchor, in the text's session step", async () => {
    const { session, ask, user } = setUp();

    const answer = ask(null);
    const dialog = within(await screen.findByRole("dialog", { name: "Link" }));
    await user.selectOptions(dialog.getByRole("combobox", { name: "Section" }), "Opening times");
    await user.click(dialog.getByRole("button", { name: "Save Link" }));

    const pageId = session.ui.getState().pageId;
    await expect(answer).resolves.toEqual({
      href: `webforge:page/${pageId}#opening-times`,
      newTab: false,
    });
    const section = currentPage(session)?.doc.content.find((node) => node.props.id === "times");
    expect(section?.props.advanced).toEqual({ anchorId: "opening-times" });
    // The text's step: the link that follows from the canvas joins it, and undo takes both away.
    const [entry] = session.history.entries();
    expect(entry?.label).toBe("Edited Text text");
    expect(entry?.coalesceKey).toBe(`text:${pageId}:text-1:text`);
  });

  it("stops picking links when it goes, leaving an open request's text as it is", async () => {
    const { engine, ask } = setUp();

    const answer = ask(null);
    cleanup();

    await expect(answer).resolves.toBeUndefined();
    expect(engine.setLinkPicker).toHaveBeenLastCalledWith(null);
  });
});
