// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { NodeDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { FindReplacePanel } from "./FindReplacePanel.js";
import { FIND_REPLACE_PANEL_ID, registerFindReplacePanel } from "./register-find-replace-panel.js";

afterEach(cleanup);

const heading = (id: string, text: string): NodeDoc => ({ type: "Heading", props: { id, text } });

/** The panel as the area registers it, on a home page saying Smith twice, drawn. */
function setUp() {
  const site = structuredClone(starterSite());
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("No home page");
  home.title = "Home";
  home.doc.content = [heading("hello", "Smith & Sons"), heading("again", "Ask Smith")];
  const session = sessionWith(site);
  const { panels } = registriesForTest();
  const commands = createCommandRegistry();
  const confirmSiteWide = vi.fn(async () => true);
  const show = vi.spyOn(panels, "show");
  const remove = registerFindReplacePanel({
    session,
    panels,
    commands,
    settings: createSettingsRegistry(),
    siteWide: { confirmSiteWide },
  });
  const [panel] = panels.list();
  if (panel === undefined) throw new Error("No panel");
  const Panel = panel.component;
  render(<Panel />);
  return { session, panels, commands, show, remove, confirmSiteWide, home: site.homePageId };
}

const type = (name: string, value: string) =>
  fireEvent.change(screen.getByRole(name === "Find" ? "searchbox" : "textbox", { name }), {
    target: { value },
  });

describe("Find and Replace, as the area registers it", () => {
  it("is in the bottom drawer, with Edit › Find and Replace… on Ctrl+F", () => {
    const { panels, commands, remove } = setUp();

    expect(panels.list()).toEqual([
      expect.objectContaining({
        id: FIND_REPLACE_PANEL_ID,
        slot: "drawer",
        title: "Find and Replace",
      }),
    ]);
    expect(commands.get(COMMAND_IDS.findReplace)).toEqual(
      expect.objectContaining({ label: "Find and Replace…", menu: "edit" }),
    );
    remove();
    expect(panels.list()).toEqual([]);
    expect(commands.get(COMMAND_IDS.findReplace)).toBeUndefined();
  });

  it("shows itself with the cursor in Find when the command runs", () => {
    const { commands, show } = setUp();

    act(() => {
      commands.run(COMMAND_IDS.findReplace);
    });

    expect(show).toHaveBeenCalledWith(FIND_REPLACE_PANEL_ID);
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Find" }));
  });

  it("lists what it finds by page, and follows the site as it changes", () => {
    const { session, home } = setUp();
    type("Find", "smith");

    expect(screen.getByRole("status").textContent).toBe("2 matches in 1 place");
    const page = screen.getByRole("region", { name: "Home" });
    expect(within(page).getAllByRole("listitem")).toHaveLength(2);

    act(() => {
      session.edit("props", "Edited", (draft) => {
        draft.pages[home]?.doc.content.pop();
      });
    });
    expect(screen.getByRole("status").textContent).toBe("1 match in 1 place");
  });

  it("finds only the same capitals, or whole words, when asked", () => {
    setUp();
    type("Find", "smith");
    fireEvent.click(screen.getByRole("checkbox", { name: "Match case" }));
    expect(screen.getByRole("status").textContent).toBe("Nothing found.");

    type("Find", "Smit");
    fireEvent.click(screen.getByRole("checkbox", { name: "Whole words" }));
    expect(screen.getByRole("status").textContent).toBe("Nothing found.");
  });

  it("shows where a match is, and replaces it alone", () => {
    const { session, home } = setUp();
    type("Find", "Smith");
    type("Replace with", "Smyth");

    fireEvent.click(screen.getByRole("button", { name: "Heading · Text: Ask Smith" }));
    expect(session.ui.getState().nodeId).toBe("again");

    fireEvent.click(screen.getByRole("button", { name: "Replace in 'Smith & Sons' on Home" }));
    const content = session.history.document.getState().pages[home]?.doc.content;
    expect(content?.map((node) => node.props.text)).toEqual(["Smyth & Sons", "Ask Smith"]);
  });

  it("replaces all as one undo step", async () => {
    const { session, home, confirmSiteWide } = setUp();
    type("Find", "Smith");
    type("Replace with", "Smyth");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Replace All" }));
    });

    // One page: nothing to confirm.
    expect(confirmSiteWide).not.toHaveBeenCalled();
    const content = session.history.document.getState().pages[home]?.doc.content;
    expect(content?.map((node) => node.props.text)).toEqual(["Smyth & Sons", "Ask Smyth"]);
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "Replaced 'Smith' with 'Smyth' in 1 place",
    ]);
    expect(screen.getByRole("status").textContent).toBe("Nothing found.");
  });
});

describe("FindReplacePanel", () => {
  const draw = (query: string) =>
    render(
      <FindReplacePanel
        state={{ query, replacement: "", matchCase: false, wholeWords: false }}
        onChange={() => undefined}
        groups={[]}
        onShow={() => undefined}
        onReplace={() => undefined}
        onReplaceAll={() => undefined}
      />,
    );

  it("says what it searches before anything is typed, and offers nothing to replace", () => {
    draw("");

    expect(screen.getByRole("status").textContent).toMatch(/^Type the text to find/);
    expect(screen.getByRole("button", { name: "Replace All" }).hasAttribute("disabled")).toBe(true);
  });
});
