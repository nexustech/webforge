// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { registerStylesheetPanel, STYLESHEET_PANEL_ID } from "./register-stylesheet-panel.js";

afterEach(cleanup);

/** The panel as the area registers it, in `level` mode. */
function setUp(level: "simple" | "advanced") {
  const session = sessionWith();
  const { panels, commands } = registriesForTest();
  const preferences = createPreferencesStore({
    preferences: { ...DEFAULT_PREFERENCES, editorLevel: level },
  });
  const show = vi.spyOn(panels, "show");
  const api = fakePreloadApi();
  const remove = registerStylesheetPanel({
    session,
    panels,
    commands,
    preferences,
    canvas: () => api.canvas,
    allowListConfirmed: createStore(() => false),
  });
  return { session, panels, commands, preferences, show, remove };
}

describe("registerStylesheetPanel (CT-8, 6.8)", () => {
  it("puts the Stylesheet panel in the drawer in Advanced mode, and removes it", () => {
    const { panels, remove } = setUp("advanced");

    expect(panels.list()).toEqual([
      expect.objectContaining({
        id: STYLESHEET_PANEL_ID,
        slot: "drawer",
        title: "Stylesheet",
        advancedOnly: true,
      }),
    ]);
    remove();
    expect(panels.list()).toEqual([]);
  });

  it("shows the panel from View › Stylesheet, on only in Advanced mode", () => {
    const { commands, preferences, show } = setUp("simple");

    expect(commands.get(COMMAND_IDS.stylesheet)).toMatchObject({ menu: "view", enabled: false });
    expect(commands.run(COMMAND_IDS.stylesheet)).toBe(false);

    act(() => preferences.change({ editorLevel: "advanced" }));
    expect(commands.run(COMMAND_IDS.stylesheet)).toBe(true);
    expect(show).toHaveBeenCalledWith(STYLESHEET_PANEL_ID);
  });

  it("draws the site's stylesheet in a code editor, with the buttons off until something is selected", async () => {
    const { panels, session } = setUp("advanced");
    act(() =>
      session.edit("props", "Edited site CSS", (draft) => {
        draft.code.css = ".hero { color: red; }";
      }),
    );
    const [panel] = panels.list();
    if (panel === undefined) throw new Error("No panel");
    const Panel = panel.component;
    render(<Panel />);

    // CodeMirror loads with the panel, never with the window.
    const editor = await screen.findByRole("textbox", { name: "Stylesheet (custom.css)" });
    expect(editor.textContent).toBe(".hero { color: red; }");
    expect(screen.getByRole("button", { name: "Target This Element" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("puts the caret in a targeted rule once, not again when the panel reopens after Undo", async () => {
    const { panels, session, commands } = setUp("advanced");
    const home = session.history.document.getState().homePageId;
    const [first] = session.history.document.getState().pages[home]?.doc.content ?? [];
    if (first === undefined) throw new Error("Nothing on the home page");
    act(() => {
      session.edit("props", "Set anchor", (draft) => {
        const node = draft.pages[home]?.doc.content[0];
        if (node !== undefined) node.props.advanced = { anchorId: "welcome" };
      });
      session.select(first.props.id);
    });
    const [panel] = panels.list();
    if (panel === undefined) throw new Error("No panel");
    const Panel = panel.component;
    const editorBox = () => screen.findByRole("textbox", { name: "Stylesheet (custom.css)" });

    // Target This Element: the rule, and the caret in it.
    const shown = render(<Panel />);
    await act(async () => {
      commands.run("stylesheet.target");
    });
    await waitFor(async () => expect((await editorBox()).textContent).toContain("#welcome {"));
    await waitFor(async () =>
      expect((await editorBox()).contains(document.activeElement)).toBe(true),
    );

    // Closed, the rule undone, then opened again: the old caret is gone, nothing throws.
    shown.unmount();
    act(() => session.history.undo());
    (document.activeElement as HTMLElement | null)?.blur();
    render(<Panel />);
    const reopened = await editorBox();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(reopened.textContent).toBe("");
    expect(reopened.contains(document.activeElement)).toBe(false);
  });
});
