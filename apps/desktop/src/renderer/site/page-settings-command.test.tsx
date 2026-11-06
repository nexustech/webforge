// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createCommandRegistry } from "../shell/commands.js";
import { openedDialog } from "../shell/opened-dialog.test-helper.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { sessionWith } from "../testing/fixtures.js";
import { followersOf } from "../testing/followers.test-helper.js";
import { addPage } from "./page-actions.js";
import { registerPageSettingsCommand } from "./page-settings-command.js";

afterEach(cleanup);

function setUp() {
  const session = sessionWith();
  const commands = createCommandRegistry();
  const dialogs = createWindowDialogs();
  const remove = registerPageSettingsCommand(commands, dialogs, session);
  render(<WindowDialogs registry={dialogs} />);
  return { session, commands, dialogs, remove };
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
    const dialog = await openedDialog("Settings for 'About'");
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
    const dialog = await openedDialog("Settings for 'About'");
    expect(followers()).toBeGreaterThan(0);
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    expect(followers()).toBe(0);
  });

  it("removes the command and the dialog when asked", () => {
    const { commands, dialogs, remove } = setUp();
    expect(commands.list().map((command) => command.id)).toContain("page.settings");

    act(() => remove());

    expect(commands.list().map((command) => command.id)).not.toContain("page.settings");
    expect(dialogs.list()).toEqual([]);
  });
});
