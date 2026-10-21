import type { CanvasAction, CanvasEngine } from "@webforge/engine";
import type { MessageKey } from "@webforge/i18n";
import { t } from "@webforge/i18n";
import type { CommandRegistry, MenuId } from "../shell/commands.js";

/** The canvas's keyboard actions (1.12), in the order the Edit menu and command box list them. */
const CANVAS_COMMANDS: readonly {
  readonly id: string;
  readonly action: CanvasAction;
  readonly label: MessageKey;
  readonly shortcut: string;
  readonly menu?: MenuId;
}[] = [
  {
    id: "edit.duplicate",
    action: "duplicate",
    label: "canvas.duplicate",
    shortcut: "Mod+D",
    menu: "edit",
  },
  { id: "edit.delete", action: "delete", label: "canvas.delete", shortcut: "Delete", menu: "edit" },
  {
    id: "edit.moveUp",
    action: "moveUp",
    label: "canvas.moveUp",
    shortcut: "Alt+ArrowUp",
    menu: "edit",
  },
  {
    id: "edit.moveDown",
    action: "moveDown",
    label: "canvas.moveDown",
    shortcut: "Alt+ArrowDown",
    menu: "edit",
  },
  {
    id: "edit.selectPrevious",
    action: "selectPrevious",
    label: "canvas.selectPrevious",
    shortcut: "ArrowUp",
  },
  {
    id: "edit.selectNext",
    action: "selectNext",
    label: "canvas.selectNext",
    shortcut: "ArrowDown",
  },
];

/** Actions that need a selected element; the select actions also start from none. */
const NEEDS_SELECTION: ReadonlySet<CanvasAction> = new Set([
  "duplicate",
  "delete",
  "moveUp",
  "moveDown",
]);

/**
 * Registers the canvas's keyboard actions as commands, so the Edit menu, the command box and their
 * shortcuts all reach them: arrows select, Alt+arrows move, Mod+D duplicates, Delete deletes. Each
 * runs on the canvas's selected element as one undo step. Returns a function that removes them and
 * one that enables the ones needing a selection as the selection comes and goes.
 */
export function registerCanvasCommands(
  registry: CommandRegistry,
  engine: CanvasEngine,
  beforeAction: () => void,
): { readonly remove: () => void; readonly setHasSelection: (selected: boolean) => void } {
  const removers = CANVAS_COMMANDS.map((command) =>
    registry.register({
      id: command.id,
      label: t(command.label),
      shortcut: command.shortcut,
      ...(command.menu === undefined ? {} : { menu: command.menu }),
      enabled: !NEEDS_SELECTION.has(command.action),
      run: () => {
        beforeAction();
        engine.perform(command.action);
      },
    }),
  );
  return {
    remove: () => {
      for (const remove of removers) remove();
    },
    setHasSelection: (selected) => {
      for (const command of CANVAS_COMMANDS) {
        if (NEEDS_SELECTION.has(command.action)) registry.update(command.id, { enabled: selected });
      }
    },
  };
}
