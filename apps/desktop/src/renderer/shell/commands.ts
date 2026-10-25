import { t } from "@webforge/i18n";
import { reportFailure } from "../log.js";
import { COMMAND_SHORTCUTS, platformKeys, type StandardShortcut } from "./shortcut-standard.js";

/**
 * The command registry: every action the title bar, the app menu, the command box and keyboard
 * shortcuts offer. Areas contribute commands with {@link CommandRegistry.register} instead of
 * editing the shell, so Undo, Export or Add page reach every surface the same way. Their keys come
 * from the shortcut standard (F-ED-27, `shortcut-standard.ts`), by command id.
 */

/** The app menu a command appears in. */
export type MenuId = "file" | "edit" | "view" | "help";

/**
 * The command palette's group for a command that isn't one of the app's own (F-ED-26, UX-11):
 * a page to go to, or a section or element to add.
 */
export type PaletteGroup = "pages" | "add";

/** One action. `label` is already translated (`t()`). */
export type Command = {
  /** Unique, dotted (`edit.undo`, `site.export`). */
  readonly id: string;
  readonly label: string;
  /** The app menu to list it in; commands without one are in the command box only. */
  readonly menu?: MenuId;
  /**
   * The key menus and the command box show, such as `Mod+Shift+Z` (`Mod` is Cmd on macOS, Ctrl
   * elsewhere): the first of the standard's keys this keyboard has. Set by the registry.
   */
  readonly shortcut?: string;
  /** More keys that run it, from the standard: Mod+K for the palette, Mod+Y to redo. */
  readonly extraShortcuts?: readonly string[];
  /**
   * The keys that are text's own too (Copy, Cut, Paste): they don't run the command while focus is
   * in editable text or some text is selected, so the text gets them. From the standard.
   */
  readonly textKeys?: readonly string[];
  /** Defaults to true; a disabled command is shown but can't run. */
  readonly enabled?: boolean;
  /** The palette's group for it; the app's own commands when left out. */
  readonly palette?: PaletteGroup;
  /** More words the palette finds it by (a page's file name, a component's category). */
  readonly keywords?: readonly string[];
  readonly run: () => void | Promise<void>;
};

/** A command's keys: its shortcut, then any others. */
const keysOf = (command: Command): readonly string[] => [
  ...(command.shortcut === undefined ? [] : [command.shortcut]),
  ...(command.extraShortcuts ?? []),
];

/**
 * A command as an area registers it: its keys come from the shortcut standard, never from the
 * area, so they can't differ between the menus, the command box and the sheet.
 */
export type CommandSpec = Omit<Command, "shortcut" | "extraShortcuts" | "textKeys"> & {
  readonly shortcut?: never;
  readonly extraShortcuts?: never;
  readonly textKeys?: never;
};

/** What a registered command's owner may change later, such as Undo becoming available. */
type CommandChanges = Partial<Pick<Command, "label" | "enabled">>;

/** The registry; one per window. */
export type CommandRegistry = {
  /**
   * Adds a command, with its keys from the standard, and returns a function that removes it. Ids
   * must be unique.
   */
  register(command: CommandSpec): () => void;
  /** Changes a registered command; ignored if it isn't registered. */
  update(id: string, changes: CommandChanges): void;
  /** Runs a command if it is registered and enabled, and not paused; returns whether it ran. */
  run(id: string): boolean;
  /**
   * Stops every command from running, from any surface, until the returned function is called:
   * while a question about the whole site is open (D7). Pauses nest.
   */
  pause(): () => void;
  /** The registered commands, in registration order. Stable until something changes. */
  list(): readonly Command[];
  get(id: string): Command | undefined;
  /** Calls `listener` after every change; returns a function that stops it. */
  subscribe(listener: () => void): () => void;
};

/** `command` with its keys from `standard`, the shown one first: the first this keyboard has. */
function withKeys(
  command: CommandSpec,
  standard: StandardShortcut | undefined,
  mac: boolean,
): Command {
  if (standard === undefined) {
    return command;
  }
  // This platform's keys only (#290): a Mac's Cmd+Esc is no key on Windows, Windows' Alt+arrows
  // none on a Mac.
  const keys = platformKeys(standard, mac);
  const [shown, ...others] = [
    ...keys.filter((key) => onKeyboard(key, mac)),
    ...keys.filter((key) => !onKeyboard(key, mac)),
  ];
  const text = standard.text === true ? keys : (standard.text ?? []);
  return {
    ...command,
    ...(shown === undefined ? {} : { shortcut: shown }),
    ...(others.length === 0 ? {} : { extraShortcuts: others }),
    ...(text.length === 0 ? {} : { textKeys: text }),
  };
}

/**
 * Creates an empty registry. Commands take their keys from `shortcuts` (the standard), showing
 * the ones a Mac keyboard has when `mac`.
 */
export function createCommandRegistry({
  shortcuts = COMMAND_SHORTCUTS,
  mac = isMac(),
}: {
  readonly shortcuts?: Readonly<Record<string, StandardShortcut>>;
  readonly mac?: boolean;
} = {}): CommandRegistry {
  const commands = new Map<string, Command>();
  /** Who registered each id, so a stale unregister can't remove a later registration. */
  const owners = new Map<string, object>();
  const listeners = new Set<() => void>();
  let snapshot: readonly Command[] = [];
  let pauses = 0;

  const changed = () => {
    snapshot = [...commands.values()];
    for (const listener of listeners) listener();
  };

  return {
    register(spec) {
      if (commands.has(spec.id)) {
        throw new Error(`Command "${spec.id}" is already registered`);
      }
      const command = withKeys(spec, shortcuts[spec.id], mac);
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
      if (command === undefined || command.enabled === false || pauses > 0) {
        return false;
      }
      const result = command.run();
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          reportFailure(`command.${id}`, error);
        });
      }
      return true;
    },
    pause() {
      pauses++;
      let resumed = false;
      return () => {
        if (!resumed) {
          resumed = true;
          pauses--;
        }
      };
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

/** The modifiers a shortcut names; one made of them alone (`Mod+Shift`) is held while dragging. */
const MODIFIERS: ReadonlySet<string> = new Set(["mod", "shift", "alt"]);

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+");
  const last = parts.at(-1)?.toLowerCase() ?? "";
  const name = MODIFIERS.has(last) ? "" : (parts.pop() ?? "");
  // `+` can't be written after a `+`, nor a space read.
  const key = (name === "Plus" ? "+" : name === "Space" ? " " : name).toLowerCase();
  const modifiers = new Set(parts.map((part) => part.toLowerCase()));
  return {
    key,
    mod: modifiers.has("mod"),
    shift: modifiers.has("shift"),
    alt: modifiers.has("alt"),
  };
}

type KeyInfo = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"> &
  Partial<Pick<KeyboardEvent, "code">>;

/**
 * The letter a key press with Alt is for. On a Mac, Option changes the character (⌥B types `∫`),
 * so a letter shortcut with Alt matches the key's place (`KeyB`) when the character isn't a letter.
 */
function letterOf(event: KeyInfo): string {
  const key = event.key.toLowerCase();
  if (event.altKey && !/^[a-z]$/.test(key) && /^Key[A-Z]$/.test(event.code ?? "")) {
    return (event.code ?? "").slice(3).toLowerCase();
  }
  return key;
}

/**
 * Whether `key` is a symbol or a digit: which Shift it needs depends on the keyboard layout (`?` is
 * Shift+/ in the US, `0` Shift+à on AZERTY), so its shortcuts match with or without Shift.
 */
const isSymbol = (key: string) => key.length === 1 && key.toLowerCase() === key.toUpperCase();

/** Whether a key press matches `shortcut`, using Cmd on macOS and Ctrl elsewhere for `Mod`. */
export function matchesShortcut(event: KeyInfo, shortcut: string, mac = isMac()): boolean {
  const parsed = parseShortcut(shortcut);
  const mod = mac ? event.metaKey : event.ctrlKey;
  const otherMod = mac ? event.ctrlKey : event.metaKey;
  return (
    (event.key.toLowerCase() === parsed.key || letterOf(event) === parsed.key) &&
    mod === parsed.mod &&
    !otherMod &&
    (event.shiftKey === parsed.shift || (isSymbol(parsed.key) && !parsed.shift)) &&
    event.altKey === parsed.alt
  );
}

/**
 * Whether a keyboard has the keys of `shortcut`: a Mac keyboard has no Delete key (fn+Backspace
 * makes one), so Delete's command shows Mod+Backspace there.
 */
export function onKeyboard(shortcut: string, mac = isMac()): boolean {
  return !(mac && parseShortcut(shortcut).key === "delete");
}

/** Keys as a Mac shows them. */
const MAC_KEYS: Readonly<Record<string, string>> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  backspace: "⌫",
  delete: "⌦",
  enter: "↩",
  escape: "⎋",
  "-": "−",
};

/** Keys as Windows shows them, the names translated. */
const OTHER_KEYS: Readonly<Record<string, () => string>> = {
  arrowup: () => "↑",
  arrowdown: () => "↓",
  arrowleft: () => "←",
  arrowright: () => "→",
  backspace: () => t("keys.backspace"),
  delete: () => t("keys.delete"),
  enter: () => t("keys.enter"),
  escape: () => t("keys.escape"),
  " ": () => t("keys.space"),
  "-": () => "−",
};

/** A shortcut as people read it: `⌘⇧Z` on macOS, `Ctrl+Shift+Z` elsewhere. */
export function formatShortcut(shortcut: string, mac = isMac()): string {
  const { key, mod, shift, alt } = parseShortcut(shortcut);
  const plain = key.length <= 1 ? key.toUpperCase() : key[0]?.toUpperCase() + key.slice(1);
  if (mac) {
    const name = key === " " ? t("keys.space") : (MAC_KEYS[key] ?? plain);
    return `${alt ? "⌥" : ""}${shift ? "⇧" : ""}${mod ? "⌘" : ""}${name}`;
  }
  const name = OTHER_KEYS[key]?.() ?? plain;
  return [mod && t("keys.ctrl"), alt && t("keys.alt"), shift && t("keys.shift"), name]
    .filter(Boolean)
    .join("+");
}

/** Keys as Electron's accelerators name them, where they differ from ours. */
const ACCELERATOR_KEYS: Readonly<Record<string, string>> = {
  arrowup: "Up",
  arrowdown: "Down",
  arrowleft: "Left",
  arrowright: "Right",
  " ": "Space",
  "+": "Plus",
};

/**
 * A shortcut as Electron's menus take it (`CmdOrCtrl+Shift+Z`), for macOS's menu bar to show it
 * (LF-13).
 */
export function electronAccelerator(shortcut: string): string {
  const { key, mod, shift, alt } = parseShortcut(shortcut);
  const name =
    ACCELERATOR_KEYS[key] ??
    (key.length <= 1 ? key.toUpperCase() : key[0]?.toUpperCase() + key.slice(1));
  return [mod && "CmdOrCtrl", alt && "Alt", shift && "Shift", name].filter(Boolean).join("+");
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

/** Open modal dialogs and menus, which own the keys while they're open. */
const MODAL = '[role="dialog"][aria-modal="true"], [role="alertdialog"], [role="menu"]';

/**
 * Whether a dialog or a menu has the keys: `target` is inside one, or the editor window `doc` has
 * a modal dialog or a menu open (a key pressed in the canvas while one is open counts too).
 * Duck-typed, as in {@link isFocusedControl}.
 */
function isInDialog(target: EventTarget | null, doc: Pick<Document, "querySelector">): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null;
  return (
    element?.closest?.('[role="dialog"], [role="alertdialog"], [role="menu"]') != null ||
    doc.querySelector(MODAL) !== null
  );
}

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

/** Whether a key press goes to editable text, or there is selected text in `target`. */
function isForText(target: Window, event: KeyboardEvent): boolean {
  const element = event.target as {
    isContentEditable?: boolean;
    tagName?: string;
    selectionStart?: number | null;
  } | null;
  // A text field has a caret (`selectionStart`); a checkbox, switch or button input has none.
  const textField =
    (element?.tagName === "INPUT" || element?.tagName === "TEXTAREA") &&
    typeof element.selectionStart === "number";
  if (element?.isContentEditable === true || textField) {
    return true;
  }
  const selection = target.getSelection();
  return selection !== null && !selection.isCollapsed && selection.toString() !== "";
}

/** The character a key types without modifiers: `KeyS` is "s", `Digit2` is "2"; else undefined. */
function ownCharacter(code: string): string | undefined {
  const match = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code);
  return (match?.[1] ?? match?.[2])?.toLowerCase();
}

/**
 * Whether a key press typed a character with AltGr. On Windows, Chromium sets AltGraph for any
 * Ctrl+Alt press when the layout has AltGr (German, French, Polish…), not only for the right Alt
 * key, so AltGraph alone can't tell typing from a shortcut: a German Ctrl+Alt+S has key "s", code
 * `KeyS`, and is Save version. It's typing when the key gives one character that isn't the key's
 * own letter or digit (Hungarian AltGr+V: key "@", code `KeyV`).
 */
function typedWithAltGr(
  event: Pick<KeyboardEvent, "key" | "code"> & {
    readonly getModifierState?: KeyboardEvent["getModifierState"];
  },
): boolean {
  if (event.getModifierState?.("AltGraph") !== true || [...event.key].length !== 1) {
    return false;
  }
  return event.key.toLowerCase() !== ownCharacter(event.code);
}

/**
 * Runs registered commands from their shortcuts on `target` (the editor window, or the canvas
 * iframe's). Listens in the bubble phase, so keys that something else already handled (text fields,
 * the history keys) never run a command twice. Shortcuts without `Mod` (arrows, Delete, `?`) don't
 * run while a control that uses those keys has focus: a text field, editable text, a list or a
 * menu. Text's own keys (Copy, Cut, Paste, Mod+K) don't run a command while text would take them.
 */
export function installCommandShortcuts(target: Window, registry: CommandRegistry): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    // While a dialog (the sheet, Link, Rename) or a menu is open, no command runs: the page behind
    // it must not change, and Mod keys such as Mod+D would change it.
    if (event.defaultPrevented || event.repeat || isInDialog(event.target, document)) {
      return;
    }
    // A character typed with AltGr (Hungarian AltGr+V is @, Polish AltGr+S is ś) is the text's,
    // never a command's (#290).
    if (typedWithAltGr(event)) {
      return;
    }
    const inControl = isFocusedControl(event.target);
    const command = registry
      .list()
      .find((entry) =>
        keysOf(entry).some(
          (shortcut) =>
            (!inControl || parseShortcut(shortcut).mod) &&
            matchesShortcut(event, shortcut) &&
            !(entry.textKeys?.includes(shortcut) === true && isForText(target, event)),
        ),
      );
    if (command !== undefined && registry.run(command.id)) {
      event.preventDefault();
    }
  };
  target.addEventListener("keydown", onKeyDown);
  return () => target.removeEventListener("keydown", onKeyDown);
}
