import { describe, expect, it, vi } from "vitest";
import { createCommandRegistry, isMac } from "../shell/commands.js";
import { registerCanvasCommands } from "./canvas-commands.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";

describe("registerCanvasCommands", () => {
  it("registers the keyboard actions with their shortcuts, the edits in the Edit menu", () => {
    const registry = createCommandRegistry();
    registerCanvasCommands(registry, createFakeEngine(), () => undefined);

    expect(
      registry.list().map((command) => [command.id, command.shortcut, command.menu ?? null]),
    ).toEqual([
      ["edit.duplicate", "Mod+D", "edit"],
      // A Mac keyboard has no Delete key, so Delete's command shows Mod+Backspace there.
      ["edit.delete", isMac() ? "Mod+Backspace" : "Delete", "edit"],
      // F-ED-27's keys: Mod+Alt+arrows move, Mod+arrows walk the page's tree.
      ["edit.moveUp", "Mod+Alt+ArrowUp", "edit"],
      ["edit.moveDown", "Mod+Alt+ArrowDown", "edit"],
      ["edit.editText", "Enter", "edit"],
      ["edit.clearText", "Backspace", null],
      ["edit.selectParent", "Mod+ArrowUp", "edit"],
      ["edit.selectChild", "Mod+ArrowDown", "edit"],
      ["edit.selectPreviousSibling", "Mod+ArrowLeft", null],
      ["edit.selectNextSibling", "Mod+ArrowRight", null],
      ["edit.selectPrevious", "ArrowUp", null],
      ["edit.selectNext", "ArrowDown", null],
    ]);
    // Text's own keys there (caret moves, Mod+Backspace deletes a word): left to the text while it
    // is edited.
    expect(
      registry
        .list()
        .filter((command) => command.textKeys !== undefined)
        .map((command) => command.id),
    ).toEqual([
      "edit.delete",
      "edit.moveUp",
      "edit.moveDown",
      "edit.selectParent",
      "edit.selectChild",
      "edit.selectPreviousSibling",
      "edit.selectNextSibling",
    ]);
    expect(registry.get("edit.delete")?.label).toBe("Delete");
    // Cmd+Delete on a Mac, whose delete key is Backspace (decision of 23 Oct 2026): there it is the
    // shortcut shown, and Delete the extra one.
    expect(registry.get("edit.delete")?.extraShortcuts).toEqual([
      isMac() ? "Delete" : "Mod+Backspace",
    ]);
  });

  it("deletes with Backspace an element that has no text of its own, unless the layout is locked", () => {
    const registry = createCommandRegistry();
    const engine = createFakeEngine();
    const commands = registerCanvasCommands(registry, engine, () => undefined);
    commands.setHasSelection(true);

    // A Heading: its text is emptied and edited.
    vi.mocked(engine.perform).mockReturnValue(true);
    registry.run("edit.clearText");
    expect(vi.mocked(engine.perform).mock.calls).toEqual([["clearText"]]);
    // A Section: no text of its own, so it goes, as Delete does it.
    vi.mocked(engine.perform)
      .mockClear()
      .mockImplementation((action) => action !== "clearText");
    registry.run("edit.clearText");
    expect(vi.mocked(engine.perform).mock.calls).toEqual([["clearText"], ["delete"]]);
    // Content mode keeps the layout (M3).
    vi.mocked(engine.perform).mockClear();
    commands.setLayoutLocked(true);
    registry.run("edit.clearText");

    expect(vi.mocked(engine.perform).mock.calls).toEqual([["clearText"]]);
  });

  it("runs the action on the engine after ending a text session", () => {
    const registry = createCommandRegistry();
    const engine = createFakeEngine();
    const beforeAction = vi.fn();
    const commands = registerCanvasCommands(registry, engine, beforeAction);
    commands.setHasSelection(true);

    registry.run("edit.delete");

    expect(beforeAction).toHaveBeenCalledOnce();
    expect(engine.perform).toHaveBeenCalledWith("delete");
  });

  it("turns the edits of one element off while several are selected (1.31)", () => {
    const registry = createCommandRegistry();
    const commands = registerCanvasCommands(registry, createFakeEngine(), () => undefined);
    commands.setHasSelection(true);

    commands.setSeveral(true);
    const enabled = (id: string) => registry.get(id)?.enabled;
    expect(
      ["edit.duplicate", "edit.delete", "edit.moveUp", "edit.editText", "edit.clearText"].map(
        enabled,
      ),
    ).toEqual([false, false, false, false, false]);
    // Walking the page's tree selects from the one shown, ending the multi-selection.
    expect(enabled("edit.selectParent")).toBe(true);
    commands.setSeveral(false);
    expect(enabled("edit.delete")).toBe(true);
  });

  it("gives duplicate, delete and the moves to `bulk` while several are selected (1.31)", () => {
    const registry = createCommandRegistry();
    const engine = createFakeEngine();
    const bulk = vi.fn();
    const commands = registerCanvasCommands(registry, engine, () => undefined, bulk);
    commands.setHasSelection(true);

    commands.setSeveral(true);
    for (const id of ["edit.duplicate", "edit.delete", "edit.moveUp", "edit.moveDown"]) {
      expect(registry.run(id)).toBe(true);
    }
    // Text is one element's.
    expect(registry.get("edit.editText")?.enabled).toBe(false);

    expect(bulk.mock.calls).toEqual([["duplicate"], ["delete"], ["moveUp"], ["moveDown"]]);
    expect(engine.perform).not.toHaveBeenCalled();
  });

  it("turns duplicate, delete and moves off while Content mode locks the layout (M3)", () => {
    const registry = createCommandRegistry();
    const engine = createFakeEngine();
    const commands = registerCanvasCommands(registry, engine, () => undefined);
    commands.setHasSelection(true);

    commands.setLayoutLocked(true);
    const enabled = ["edit.duplicate", "edit.delete", "edit.moveUp", "edit.moveDown"].map(
      (id) => registry.get(id)?.enabled,
    );
    expect(enabled).toEqual([false, false, false, false]);
    expect(registry.run("edit.selectNext")).toBe(true);
    // Moving the selection and editing text are no layout changes.
    expect(registry.run("edit.selectParent")).toBe(true);
    expect(registry.run("edit.editText")).toBe(true);
    expect(engine.perform).toHaveBeenCalledWith("editText");
    commands.setLayoutLocked(false);
    expect(registry.get("edit.delete")?.enabled).toBe(true);
  });

  it("enables the edits only while something is selected; selecting always works", () => {
    const registry = createCommandRegistry();
    const engine = createFakeEngine();
    const commands = registerCanvasCommands(registry, engine, () => undefined);

    expect(registry.run("edit.duplicate")).toBe(false);
    expect(registry.run("edit.selectNext")).toBe(true);
    commands.setHasSelection(true);
    expect(registry.run("edit.duplicate")).toBe(true);
    commands.setHasSelection(false);
    expect(registry.get("edit.moveDown")?.enabled).toBe(false);

    commands.remove();
    expect(registry.list()).toEqual([]);
  });
});
