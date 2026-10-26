import { describe, expect, it, vi } from "vitest";
import { registriesForTest } from "../testing/fixtures.js";
import { createStudio } from "./studio/studio-state.js";
import { registerThemeCommands } from "./theme-commands.js";

describe("View → Theme… and Theme Studio… (#452, 2.3b)", () => {
  it("are in the View menu: the first shows the Theme tab, the second opens Theme Studio", () => {
    const { commands, panels } = registriesForTest();
    const shown = vi.fn();
    panels.onShow(shown);
    const studio = createStudio();
    const remove = registerThemeCommands(commands, panels, studio);

    const command = commands.list().find((each) => each.id === "theme.show");
    expect(command).toMatchObject({ label: "Theme…", menu: "view" });
    commands.run("theme.show");
    expect(shown).toHaveBeenCalledWith("theme");
    expect(studio.getState().open).toBe(false);
    commands.run("theme.studio");
    expect(studio.getState().open).toBe(true);
    // Theme Studio is the window's: the tab shown stays as it was.
    expect(shown).toHaveBeenCalledOnce();

    remove();
    expect(commands.list().some((each) => each.id.startsWith("theme."))).toBe(false);
  });
});
