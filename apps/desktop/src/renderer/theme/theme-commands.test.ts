import { describe, expect, it, vi } from "vitest";
import { registriesForTest } from "../testing/fixtures.js";
import { registerThemeCommands } from "./theme-commands.js";

describe("View → Theme… (#452)", () => {
  it("is in the View menu, and shows the Theme tab", () => {
    const { commands, panels } = registriesForTest();
    const shown = vi.fn();
    panels.onShow(shown);
    const remove = registerThemeCommands(commands, panels);

    const command = commands.list().find((each) => each.id === "theme.show");
    expect(command).toMatchObject({ label: "Theme…", menu: "view" });
    commands.run("theme.show");
    expect(shown).toHaveBeenCalledWith("theme");

    remove();
    expect(commands.list().some((each) => each.id === "theme.show")).toBe(false);
  });
});
