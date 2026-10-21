import { describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "../shell/commands.js";
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
      ["edit.delete", "Delete", "edit"],
      ["edit.moveUp", "Alt+ArrowUp", "edit"],
      ["edit.moveDown", "Alt+ArrowDown", "edit"],
      ["edit.selectPrevious", "ArrowUp", null],
      ["edit.selectNext", "ArrowDown", null],
    ]);
    expect(registry.get("edit.delete")?.label).toBe("Delete");
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
