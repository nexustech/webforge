import type { CanvasAction, CanvasEngine } from "@webforge/engine";
import type { MessageKey } from "@webforge/i18n";
import { t } from "@webforge/i18n";
import type { CommandRegistry, MenuId } from "../shell/commands.js";

/**
 * The canvas's keyboard actions (1.12, 1.30), in the order the Edit menu and command box list
 * them, with Bootstrap Studio's keys (F-ED-27). `text`: the shortcut is text's too (Mod+arrows move
 * the caret, Mod+Backspace deletes a word), so it doesn't run while text is being edited. `extra`:
 * more keys, not shown: Mod+Backspace deletes, as Cmd+Delete does on a Mac (decision of 23 Oct
 * 2026).
 */
const CANVAS_COMMANDS: readonly {
  readonly id: string;
  readonly action: CanvasAction;
  readonly label: MessageKey;
  readonly shortcut: string;
  readonly menu?: MenuId;
  readonly text?: boolean;
  readonly extra?: readonly string[];
}[] = [
  {
    id: "edit.duplicate",
    action: "duplicate",
    label: "canvas.duplicate",
    shortcut: "Mod+D",
    menu: "edit",
  },
  {
    id: "edit.delete",
    action: "delete",
    label: "canvas.delete",
    shortcut: "Delete",
    menu: "edit",
    text: true,
    extra: ["Mod+Backspace"],
  },
  {
    id: "edit.moveUp",
    action: "moveUp",
    label: "canvas.moveUp",
    shortcut: "Mod+Alt+ArrowUp",
    menu: "edit",
    text: true,
  },
  {
    id: "edit.moveDown",
    action: "moveDown",
    label: "canvas.moveDown",
    shortcut: "Mod+Alt+ArrowDown",
    menu: "edit",
    text: true,
  },
  {
    id: "edit.editText",
    action: "editText",
    label: "canvas.editText",
    shortcut: "Enter",
    menu: "edit",
  },
  {
    id: "edit.clearText",
    action: "clearText",
    label: "canvas.clearText",
    shortcut: "Backspace",
  },
  {
    id: "edit.selectParent",
    action: "selectParent",
    label: "canvas.selectParent",
    shortcut: "Mod+ArrowUp",
    menu: "edit",
    text: true,
  },
  {
    id: "edit.selectChild",
    action: "selectChild",
    label: "canvas.selectChild",
    shortcut: "Mod+ArrowDown",
    menu: "edit",
    text: true,
  },
  {
    id: "edit.selectPreviousSibling",
    action: "selectPreviousSibling",
    label: "canvas.selectPreviousSibling",
    shortcut: "Mod+ArrowLeft",
    text: true,
  },
  {
    id: "edit.selectNextSibling",
    action: "selectNextSibling",
    label: "canvas.selectNextSibling",
    shortcut: "Mod+ArrowRight",
    text: true,
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

/** Actions that need a selected element; the select-previous/next actions also start from none. */
const NEEDS_SELECTION: ReadonlySet<CanvasAction> = new Set([
  "duplicate",
  "delete",
  "moveUp",
  "moveDown",
  "editText",
  "clearText",
  "selectParent",
  "selectChild",
  "selectPreviousSibling",
  "selectNextSibling",
]);

/** Actions that change the layout, which Content mode locks (M3); editing text doesn't. */
const CHANGES_LAYOUT: ReadonlySet<CanvasAction> = new Set([
  "duplicate",
  "delete",
  "moveUp",
  "moveDown",
]);

/**
 * Registers the canvas's keyboard actions as commands, so the Edit menu, the command box and their
 * shortcuts all reach them: arrows select, Mod+arrows walk the page's tree (parent, child,
 * siblings), Mod+Alt+arrows move, Enter edits text and Backspace empties it (or deletes an element
 * with no text), Mod+D duplicates, Delete and Mod+Backspace delete. Each runs on the canvas's selected element as one undo step. Returns a function
 * that removes them, one that enables the ones needing a selection as the selection comes and goes,
 * and one that turns the ones changing the layout (duplicate, delete, move) off while Content mode
 * locks it (M3).
 */
export function registerCanvasCommands(
  registry: CommandRegistry,
  engine: CanvasEngine,
  beforeAction: () => void,
): {
  readonly remove: () => void;
  readonly setHasSelection: (selected: boolean) => void;
  readonly setLayoutLocked: (locked: boolean) => void;
} {
  let selected = false;
  let locked = false;
  const update = () => {
    for (const command of CANVAS_COMMANDS) {
      if (NEEDS_SELECTION.has(command.action)) {
        const layout = CHANGES_LAYOUT.has(command.action);
        registry.update(command.id, { enabled: selected && !(layout && locked) });
      }
    }
  };
  const removers = CANVAS_COMMANDS.map((command) =>
    registry.register({
      id: command.id,
      label: t(command.label),
      shortcut: command.shortcut,
      ...(command.menu === undefined ? {} : { menu: command.menu }),
      ...(command.text === true ? { textShortcut: true } : {}),
      ...(command.extra === undefined ? {} : { extraShortcuts: command.extra }),
      enabled: !NEEDS_SELECTION.has(command.action),
      run: () => {
        beforeAction();
        // Backspace on an element with no text of its own (a Section, an image) deletes it, as
        // Delete does: a Mac's delete key is Backspace (decision of 23 Oct 2026).
        if (!engine.perform(command.action) && command.action === "clearText" && !locked) {
          engine.perform("delete");
        }
      },
    }),
  );
  return {
    remove: () => {
      for (const remove of removers) remove();
    },
    setHasSelection: (next) => {
      selected = next;
      update();
    },
    setLayoutLocked: (next) => {
      locked = next;
      update();
    },
  };
}
