// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry, installCommandShortcuts } from "./commands.js";
import { ShortcutSheet, shortcutSheet } from "./ShortcutSheet.js";

afterEach(cleanup);

/** A registry with a few of the app's commands, keyed by the standard. */
function registryWith(mac: boolean) {
  const registry = createCommandRegistry({ mac });
  registry.register({ id: COMMAND_IDS.undo, label: "Undo", menu: "edit", run: vi.fn() });
  registry.register({ id: "edit.delete", label: "Delete", menu: "edit", run: vi.fn() });
  registry.register({ id: COMMAND_IDS.commandBox, label: "Search Commands…", run: vi.fn() });
  // No keys of its own: not on the sheet.
  registry.register({ id: COMMAND_IDS.theme, label: "Use Dark Theme", run: vi.fn() });
  return registry;
}

describe("shortcutSheet", () => {
  it("lists the registered commands' keys by group, then the keys handled elsewhere", () => {
    const sheet = shortcutSheet(registryWith(false).list(), false);

    expect(sheet.map(({ group }) => group)).toEqual([
      "site",
      "edit",
      "view",
      "text",
      "layers",
      "editPanel",
    ]);
    expect(sheet.find(({ group }) => group === "edit")?.rows.slice(0, 2)).toEqual([
      { label: "Undo", keys: ["Ctrl+Z"] },
      { label: "Delete", keys: ["Delete", "Ctrl+Backspace"] },
    ]);
    expect(sheet.find(({ group }) => group === "view")?.rows).toEqual([
      { label: "Search Commands…", keys: ["Ctrl+P", "Ctrl+K"] },
    ]);
    // Saving is the main process's, not a command, and Preview isn't registered yet.
    expect(sheet.find(({ group }) => group === "site")?.rows).toEqual([
      { label: "Save now", keys: ["Ctrl+S"] },
    ]);
  });

  it("lists only the commands' keys without the editor (the start screen)", () => {
    const sheet = shortcutSheet(registryWith(false).list(), false, []);

    expect(sheet.map(({ group }) => group)).toEqual(["edit", "view"]);
  });

  it("shows a Mac's keys, without the Delete key it doesn't have", () => {
    const edit = shortcutSheet(registryWith(true).list(), true).find(
      ({ group }) => group === "edit",
    );

    expect(edit?.rows.slice(0, 2)).toEqual([
      { label: "Undo", keys: ["⌘Z"] },
      { label: "Delete", keys: ["⌘⌫"] },
    ]);
  });

  it("shows only the keys of the person's system: no Ctrl+Esc on Windows, its Alt+arrows (#290)", () => {
    const registry = (mac: boolean) => {
      const commands = createCommandRegistry({ mac });
      commands.register({ id: "edit.moveUp", label: "Move Up", menu: "edit", run: vi.fn() });
      return commands;
    };
    const rows = (mac: boolean) =>
      shortcutSheet(registry(mac).list(), mac).flatMap((group) => group.rows);
    const reset = "Reset an option or group to its default";

    expect(rows(false).find((row) => row.label === "Move Up")?.keys).toEqual([
      "Ctrl+Alt+↑",
      "Alt+↑",
    ]);
    expect(rows(false).some((row) => row.label === reset)).toBe(false);
    expect(rows(true).find((row) => row.label === "Move Up")?.keys).toEqual(["⌥⌘↑"]);
    expect(rows(true).find((row) => row.label === reset)?.keys).toEqual(["⌘⎋"]);
  });
});

describe("ShortcutSheet", () => {
  it("opens from the Help menu's command and from ?, listing every group", () => {
    const registry = registryWith(false);
    render(
      <CommandRegistryProvider registry={registry}>
        <ShortcutSheet />
      </CommandRegistryProvider>,
    );
    const remove = installCommandShortcuts(window, registry);

    expect(registry.get(COMMAND_IDS.shortcuts)).toMatchObject({
      label: "Keyboard Shortcuts",
      menu: "help",
      shortcut: "?",
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true }));
    });

    const sheet = screen.getByRole("dialog", { name: "Keyboard Shortcuts" });
    expect(
      within(sheet)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Site", "Editing", "View", "While editing text", "In Layers", "In the Edit panel"]);
    // The sheet lists its own key too.
    const view = within(sheet).getByRole("region", { name: "View" });
    expect(within(view).getByText("Keyboard Shortcuts").nextSibling?.textContent).toBe("?");
    remove();
  });
});
