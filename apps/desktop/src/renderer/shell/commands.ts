/**
 * The command registry: every action the title bar, the app menu, the command box and keyboard
 * shortcuts offer. Areas contribute commands with {@link CommandRegistry.register} instead of
 * editing the shell, so Undo, Export or Add page reach every surface the same way.
 */

/** The app menu a command appears in. */
export type MenuId = "file" | "edit" | "view" | "help";

/** One action. `label` is already translated (`t()`). */
export type Command = {
  /** Unique, dotted (`edit.undo`, `site.export`). */
  readonly id: string;
  readonly label: string;
  /** The app menu to list it in; commands without one are in the command box only. */
  readonly menu?: MenuId;
  /**
   * Keys that run it, such as `Mod+Shift+Z` (`Mod` is Cmd on macOS, Ctrl elsewhere). Shown in
   * menus and the command box, and handled by {@link installCommandShortcuts}.
   */
  readonly shortcut?: string;
  /** Defaults to true; a disabled command is shown but can't run. */
  readonly enabled?: boolean;
  readonly run: () => void | Promise<void>;
};

/** What a registered command's owner may change later, such as Undo becoming available. */
type CommandChanges = Partial<Pick<Command, "label" | "enabled">>;

/** The registry; one per window. */
export type CommandRegistry = {
  /** Adds a command and returns a function that removes it. Ids must be unique. */
  register(command: Command): () => void;
  /** Changes a registered command; ignored if it isn't registered. */
  update(id: string, changes: CommandChanges): void;
  /** Runs a command if it is registered and enabled; returns whether it ran. */
  run(id: string): boolean;
  /** The registered commands, in registration order. Stable until something changes. */
  list(): readonly Command[];
  get(id: string): Command | undefined;
  /** Calls `listener` after every change; returns a function that stops it. */
  subscribe(listener: () => void): () => void;
};

/** Creates an empty registry. */
export function createCommandRegistry(): CommandRegistry {
  const commands = new Map<string, Command>();
  /** Who registered each id, so a stale unregister can't remove a later registration. */
  const owners = new Map<string, object>();
  const listeners = new Set<() => void>();
  let snapshot: readonly Command[] = [];

  const changed = () => {
    snapshot = [...commands.values()];
    for (const listener of listeners) listener();
  };

  return {
    register(command) {
      if (commands.has(command.id)) {
        throw new Error(`Command "${command.id}" is already registered`);
      }
      const owner = {};
      commands.set(command.id, command);
      owners.set(command.id, owner);
      changed();
      return () => {
        if (owners.get(command.id) === owner) {
          commands.delete(command.id);
          owners.delete(command.id);
          changed();
        }
      };
    },
    update(id, changes) {
      const command = commands.get(id);
      if (command === undefined) {
        return;
      }
      const next = { ...command, ...changes };
      if (next.label === command.label && next.enabled === command.enabled) {
        return;
      }
      commands.set(id, next);
      changed();
    },
    run(id) {
      const command = commands.get(id);
      if (command === undefined || command.enabled === false) {
        return false;
      }
      const result = command.run();
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          console.error(`Command "${id}" failed`, error);
        });
      }
      return true;
    },
    list: () => snapshot,
    get: (id) => commands.get(id),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** True on macOS, where `Mod` means Cmd. */
export function isMac(platform: string = navigator.platform): boolean {
  return /^mac/i.test(platform);
}

type ParsedShortcut = {
  readonly key: string;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
};

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+");
  const key = (parts.pop() ?? "").toLowerCase();
  const modifiers = new Set(parts.map((part) => part.toLowerCase()));
  return {
    key,
    mod: modifiers.has("mod"),
    shift: modifiers.has("shift"),
    alt: modifiers.has("alt"),
  };
}

type KeyInfo = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/** Whether a key press matches `shortcut`, using Cmd on macOS and Ctrl elsewhere for `Mod`. */
export function matchesShortcut(event: KeyInfo, shortcut: string, mac = isMac()): boolean {
  const parsed = parseShortcut(shortcut);
  const mod = mac ? event.metaKey : event.ctrlKey;
  const otherMod = mac ? event.ctrlKey : event.metaKey;
  return (
    event.key.toLowerCase() === parsed.key &&
    mod === parsed.mod &&
    !otherMod &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt
  );
}

/** A shortcut as people read it: `⌘⇧Z` on macOS, `Ctrl+Shift+Z` elsewhere. */
export function formatShortcut(shortcut: string, mac = isMac()): string {
  const { key, mod, shift, alt } = parseShortcut(shortcut);
  const name = key.length === 1 ? key.toUpperCase() : key[0]?.toUpperCase() + key.slice(1);
  if (mac) {
    return `${alt ? "⌥" : ""}${shift ? "⇧" : ""}${mod ? "⌘" : ""}${name}`;
  }
  return [mod && "Ctrl", alt && "Alt", shift && "Shift", name].filter(Boolean).join("+");
}

/** Tags that use plain keys (arrows, Delete) themselves. */
const CONTROL_TAGS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]);

/** Roles of widgets that use plain keys themselves (lists, trees, menus, sliders, …). */
const CONTROL_ROLES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "combobox",
  "grid",
  "link",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "option",
  "radio",
  "radiogroup",
  "scrollbar",
  "separator",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "tree",
  "treeitem",
]);

/**
 * Whether a key press goes to a control that uses plain keys itself: a field, editable text, a
 * button, a list, a menu or a slider. A focused element that is only selectable (such as the
 * canvas's selected element) isn't one. Duck-typed, because a key pressed in the canvas iframe comes
 * from another window, where `instanceof` fails.
 */
function isFocusedControl(target: EventTarget | null): boolean {
  const element = target as {
    isContentEditable?: boolean;
    tagName?: string;
    getAttribute?: (name: string) => string | null;
    closest?: (selector: string) => unknown;
  } | null;
  // Anything inside an open dialog: the page behind it must not change.
  if (element?.closest?.('[role="dialog"], [role="alertdialog"]') != null) {
    return true;
  }
  // A draggable item (the canvas's elements, dnd-kit's role="button") takes arrows only while it
  // is being dragged with the keyboard, which then stops them first.
  if (element?.getAttribute?.("aria-roledescription") === "draggable") {
    return false;
  }
  return (
    element?.isContentEditable === true ||
    CONTROL_TAGS.has(element?.tagName ?? "") ||
    CONTROL_ROLES.has(element?.getAttribute?.("role") ?? "")
  );
}

/**
 * Runs registered commands from their shortcuts on `target` (the editor window, or the canvas
 * iframe's). Listens in the bubble phase, so keys that something else already handled (text fields,
 * the history keys) never run a command twice. Shortcuts without `Mod` (arrows, Delete) don't run
 * while a control that uses those keys has focus: a text field, editable text, a list or a menu.
 */
export function installCommandShortcuts(target: Window, registry: CommandRegistry): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat) {
      return;
    }
    const inControl = isFocusedControl(event.target);
    const command = registry
      .list()
      .find(
        (entry) =>
          entry.shortcut !== undefined &&
          (!inControl || parseShortcut(entry.shortcut).mod) &&
          matchesShortcut(event, entry.shortcut),
      );
    if (command !== undefined && registry.run(command.id)) {
      event.preventDefault();
    }
  };
  target.addEventListener("keydown", onKeyDown);
  return () => target.removeEventListener("keydown", onKeyDown);
}
