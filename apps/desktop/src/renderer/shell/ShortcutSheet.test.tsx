// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry, installCommandShortcuts } from "./commands.js";
import { filterSheet, shortcutSheet } from "./SheetGroups.js";
import { ShortcutSheet } from "./ShortcutSheet.js";

afterEach(cleanup);

/** A registry with a few of the app's commands, keyed by the standard. */
function registryWith(mac: boolean) {
  const registry = createCommandRegistry({ mac });
  registry.register({ id: COMMAND_IDS.undo, label: "Undo", menu: "edit", run: vi.fn() });
  registry.register({ id: "edit.delete", label: "Delete", menu: "edit", run: vi.fn() });
  registry.register({ id: COMMAND_IDS.commandBox, label: "Search Commands…", run: vi.fn() });
  // No keys of its own: not on the sheet.
  registry.register({ id: COMMAND_IDS.theme, label: "Use Dark Appearance", run: vi.fn() });
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

describe("Layers' rows", () => {
  const layers = (mac: boolean) =>
    shortcutSheet([], mac).find(({ group }) => group === "layers")?.rows ?? [];

  it("are one action each, with no more than two keys, and the commands' names (#1410)", () => {
    for (const mac of [false, true]) {
      for (const row of layers(mac)) expect(row.keys.length, row.label).toBeLessThanOrEqual(2);
    }
    expect(layers(false).slice(0, 9)).toEqual([
      { label: "Previous layer", keys: ["↑"] },
      { label: "Next layer", keys: ["↓"] },
      { label: "Open or close a layer", keys: ["→", "←"] },
      { label: "Select Parent", keys: ["Ctrl+↑"] },
      { label: "Select First Element Inside", keys: ["Ctrl+↓"] },
      { label: "Select Previous Element Beside It", keys: ["Ctrl+←"] },
      { label: "Select Next Element Beside It", keys: ["Ctrl+→"] },
      { label: "Move Up", keys: ["Ctrl+Alt+↑", "Alt+↑"] },
      { label: "Move Down", keys: ["Ctrl+Alt+↓", "Alt+↓"] },
    ]);
  });
});

describe("filterSheet", () => {
  const sheet = shortcutSheet(registryWith(false).list(), false);
  const found = (search: string) =>
    filterSheet(sheet, search).map(({ group, rows }) => [group, rows.map((row) => row.label)]);

  it("keeps everything when nothing is searched for", () => {
    expect(filterSheet(sheet, "  ")).toBe(sheet);
  });

  it("finds a row by its name, whatever the case, under its group's heading only", () => {
    expect(found("UNDERL")).toEqual([["text", ["Underline"]]]);
    expect(found(" move up ")).toEqual([["layers", ["Move Up"]]]);
  });

  it("finds a row by its keys, as typed with or without spaces", () => {
    expect(found("ctrl+z")).toEqual([["edit", ["Undo"]]]);
    expect(found("Ctrl + K")).toEqual([
      ["view", ["Search Commands…"]],
      ["text", ["Link"]],
    ]);
    // Keys in a row, not the start of another key's name.
    expect(found("ctrl+b")).toEqual([["text", ["Bold"]]]);
    expect(found("alt+↓")).toEqual([["layers", ["Move Down"]]]);
    // One word: any part of a key.
    expect(found("backsp")).toEqual([
      ["edit", ["Delete"]],
      ["layers", ["Delete"]],
    ]);
  });

  it("finds a Mac's keys by their symbols or their names", () => {
    const mac = shortcutSheet(registryWith(true).list(), true);
    const labels = (search: string) =>
      filterSheet(mac, search).flatMap(({ rows }) => rows.map((row) => row.label));
    expect(labels("⌘z")).toEqual(["Undo"]);
    expect(labels("cmd+z")).toEqual(["Undo"]);
    expect(labels("Command + Z")).toEqual(["Undo"]);
    expect(labels("option+cmd+↑")).toEqual(["Move Up"]);
    expect(labels("⌥⌘↓")).toEqual(["Move Down"]);
  });

  it("finds keys with more modifiers too, the same on a Mac, whose modifiers come first", () => {
    const labels = (mac: boolean, search: string) => {
      const registry = createCommandRegistry({ mac });
      registry.register({ id: COMMAND_IDS.undo, label: "Undo", run: vi.fn() });
      registry.register({ id: COMMAND_IDS.redo, label: "Redo", run: vi.fn() });
      return filterSheet(shortcutSheet(registry.list(), mac, []), search).flatMap(({ rows }) =>
        rows.map((row) => row.label),
      );
    };
    expect(labels(false, "ctrl+z")).toEqual(["Undo", "Redo"]);
    expect(labels(true, "cmd+z")).toEqual(["Undo", "Redo"]);
    expect(labels(false, "shift+ctrl+z")).toEqual(["Redo"]);
    expect(labels(true, "⇧⌘Z")).toEqual(["Redo"]);
  });

  it("leaves no group when nothing matches", () => {
    expect(found("nothing like this")).toEqual([]);
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

  it("filters by a search, says how many it found or that none match, and Esc clears it before closing", () => {
    const registry = registryWith(false);
    render(
      <CommandRegistryProvider registry={registry}>
        <ShortcutSheet />
      </CommandRegistryProvider>,
    );
    act(() => {
      registry.run(COMMAND_IDS.shortcuts);
    });
    const sheet = screen.getByRole("dialog", { name: "Keyboard Shortcuts" });
    const search = within(sheet).getByRole("searchbox", { name: "Search shortcuts" });
    const headings = () =>
      within(sheet)
        .queryAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent);

    fireEvent.change(search, { target: { value: "ctrl+z" } });
    expect(headings()).toEqual(["Editing"]);
    expect(within(sheet).getByRole("status").textContent).toBe("1 shortcut");

    fireEvent.change(search, { target: { value: "bold" } });
    expect(headings()).toEqual(["While editing text"]);

    fireEvent.change(search, { target: { value: "xyz" } });
    expect(headings()).toEqual([]);
    expect(within(sheet).getByRole("status").textContent).toBe("No shortcut matches 'xyz'.");
    expect(within(sheet).getAllByText("No shortcut matches 'xyz'.")).toHaveLength(2);

    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Keyboard Shortcuts" })).toBe(sheet);
    expect(search).toHaveProperty("value", "");
    expect(headings()).toHaveLength(6);
    expect(within(sheet).getByRole("status").textContent).toBe("");

    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Keyboard Shortcuts" })).toBeNull();
  });

  it("lists every shortcut again when opened after a search", () => {
    const registry = registryWith(false);
    render(
      <CommandRegistryProvider registry={registry}>
        <ShortcutSheet />
      </CommandRegistryProvider>,
    );
    act(() => {
      registry.run(COMMAND_IDS.shortcuts);
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search shortcuts" }), {
      target: { value: "bold" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    act(() => {
      registry.run(COMMAND_IDS.shortcuts);
    });

    expect(screen.getByRole("searchbox", { name: "Search shortcuts" })).toHaveProperty("value", "");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });
});
