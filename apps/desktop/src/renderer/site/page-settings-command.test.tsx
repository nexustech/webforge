// @vitest-environment happy-dom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createCommandRegistry } from "../shell/commands.js";
import { openedDialog } from "../shell/opened-dialog.test-helper.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { sessionWith } from "../testing/fixtures.js";
import { followersOf } from "../testing/followers.test-helper.js";
import { addPage } from "./page-actions.js";
import { createPageSettings, registerPageSettingsCommand } from "./page-settings-command.js";

afterEach(cleanup);

function setUp() {
  const session = sessionWith();
  const commands = createCommandRegistry();
  const dialogs = createWindowDialogs();
  const pageSettings = createPageSettings(session);
  const remove = registerPageSettingsCommand(commands, dialogs, session, undefined, pageSettings);
  render(<WindowDialogs registry={dialogs} />);
  return { session, commands, dialogs, remove, pageSettings };
}

/** Adds an About page and shows it. */
function showAbout(session: ReturnType<typeof setUp>["session"]) {
  const about = addPage(session, "About");
  if (about === null) throw new Error("not added");
  session.showPage(about);
  return about;
}

describe("registerPageSettingsCommand (3.17)", () => {
  it("opens Page Settings for the page shown, and saves as one undo step", async () => {
    const { session, commands } = setUp();
    const about = addPage(session, "About");
    if (about === null) throw new Error("not added");
    session.showPage(about);
    const steps = session.history.entries().length;

    act(() => {
      commands.run("page.settings");
    });
    const dialog = await openedDialog("Settings for “About”");
    // On General, as the command opens it; the description is on Search engines (#1443).
    expect(dialog.getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(dialog.getByRole("tab", { name: "Search engines" }));
    await userEvent.type(dialog.getByRole("textbox", { name: "Description" }), "Who we are.");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));

    expect(session.history.document.getState().pages[about]?.settings.description).toBe(
      "Who we are.",
    );
    expect(session.history.entries()).toHaveLength(steps + 1);
  });

  it("follows nothing of the document while it's closed (R9)", async () => {
    const session = sessionWith();
    const followers = followersOf(session.history.document);
    const commands = createCommandRegistry();
    const dialogs = createWindowDialogs();
    registerPageSettingsCommand(commands, dialogs, session);
    render(<WindowDialogs registry={dialogs} />);
    const about = addPage(session, "About");
    if (about === null) throw new Error("not added");
    session.showPage(about);
    expect(followers()).toBe(0);

    act(() => {
      commands.run("page.settings");
    });
    const dialog = await openedDialog("Settings for “About”");
    expect(followers()).toBeGreaterThan(0);
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    expect(followers()).toBe(0);
  });

  it("opens on the tab it's asked for, through the window's opener (#1443)", async () => {
    const { session, pageSettings } = setUp();
    showAbout(session);

    act(() => pageSettings.show("search"));
    const dialog = await openedDialog("Settings for “About”");

    const tab = dialog.getByRole("tab", { name: "Search engines" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(dialog.getByRole("textbox", { name: "Description" })).toBeDefined();
    // General's fields aren't drawn until its tab is chosen.
    expect(dialog.queryByRole("textbox", { name: "Title" })).toBeNull();
  });

  it("opens with the focus in the tab's first field, not on its tab, so typing goes there (#1443)", async () => {
    const { session, pageSettings } = setUp();
    showAbout(session);

    act(() => pageSettings.show());
    let dialog = await openedDialog("Settings for “About”");
    await waitFor(() =>
      expect(document.activeElement).toBe(dialog.getByRole("textbox", { name: "Title" })),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    act(() => pageSettings.show("search"));
    dialog = await openedDialog("Settings for “About”");
    await waitFor(() =>
      expect(document.activeElement).toBe(dialog.getByRole("textbox", { name: "Description" })),
    );
  });

  it("shows the problem's tab after a failed Save, its field focused (#1443)", async () => {
    const { session, pageSettings } = setUp();
    showAbout(session);
    act(() => pageSettings.show());
    const dialog = await openedDialog("Settings for “About”");
    await userEvent.clear(dialog.getByRole("textbox", { name: "Title" }));
    await userEvent.click(dialog.getByRole("tab", { name: "Social & sharing" }));

    await userEvent.click(dialog.getByRole("button", { name: "Save" }));

    expect(dialog.getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
    await waitFor(() =>
      expect(document.activeElement).toBe(dialog.getByRole("textbox", { name: "Title" })),
    );
  });

  // Tab from the tab list into the chosen tab's fields is checked in a browser (page-settings E2E):
  // happy-dom stops on the hidden panels of the tabs not chosen, which a browser skips.
  it("moves between its tabs with the arrow keys, each chosen as it's reached (#1443)", async () => {
    const { session, pageSettings } = setUp();
    showAbout(session);
    act(() => pageSettings.show());
    const dialog = await openedDialog("Settings for “About”");
    act(() => dialog.getByRole("tab", { name: "General" }).focus());

    await userEvent.keyboard("{ArrowRight}");
    const search = dialog.getByRole("tab", { name: "Search engines" });
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(dialog.getByRole("tab", { name: "Social & sharing" }));
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute("aria-selected")).toBe("true");
    expect(dialog.getByRole("textbox", { name: "Description" })).toBeDefined();
  });

  it("removes the command and the dialog when asked", () => {
    const { commands, dialogs, remove } = setUp();
    expect(commands.list().map((command) => command.id)).toContain("page.settings");

    act(() => remove());

    expect(commands.list().map((command) => command.id)).not.toContain("page.settings");
    expect(dialogs.list()).toEqual([]);
  });
});
