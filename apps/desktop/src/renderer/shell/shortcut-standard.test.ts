import { describe, expect, it } from "vitest";
import { COMMAND_IDS } from "./command-ids.js";
import {
  COMMAND_SHORTCUTS,
  OTHER_SHORTCUTS,
  platformKeys,
  SHORTCUT_GROUPS,
  WINDOWS_RESERVED_KEYS,
} from "./shortcut-standard.js";

/** Every shortcut of the standard, by command id or the sheet's label. */
const EVERY_SHORTCUT = [
  ...Object.entries(COMMAND_SHORTCUTS),
  ...OTHER_SHORTCUTS.map((entry) => [entry.label, entry] as const),
] as const;

/** Every key F-ED-27 names, with what it does (spec/02-mvp-spec.md). */
const F_ED_27: readonly (readonly [string, string])[] = [
  ["Mod+P", COMMAND_IDS.commandBox],
  ["Mod+K", COMMAND_IDS.commandBox],
  ["Mod+I", COMMAND_IDS.preview],
  ["Mod+E", COMMAND_IDS.exportSite],
  ["Mod+U", COMMAND_IDS.publish],
  ["Mod+S", "shortcuts.saveNow"],
  ["Mod+Alt+S", COMMAND_IDS.saveVersion],
  ["Mod+ArrowUp", "edit.selectParent"],
  ["Mod+ArrowDown", "edit.selectChild"],
  ["Mod+ArrowLeft", "edit.selectPreviousSibling"],
  ["Mod+ArrowRight", "edit.selectNextSibling"],
  ["Mod+Alt+ArrowUp", "edit.moveUp"],
  ["Mod+Alt+ArrowDown", "edit.moveDown"],
  ["Enter", "edit.editText"],
  ["Backspace", "edit.clearText"],
  ["Mod+Backspace", "edit.delete"],
  ["F2", "edit.rename"],
  ["Mod+/", "edit.toggleHidden"],
  ["Mod+D", "edit.duplicate"],
  ["Mod+Shift+V", COMMAND_IDS.pasteLinked],
  ["Mod+=", COMMAND_IDS.zoomIn],
  ["Mod+-", COMMAND_IDS.zoomOut],
  ["Mod+0", COMMAND_IDS.zoomActual],
  ["Mod+1", COMMAND_IDS.desktopView],
  ["Mod+2", COMMAND_IDS.tabletView],
  ["Mod+3", COMMAND_IDS.mobileView],
  ["?", COMMAND_IDS.shortcuts],
  ["Mod+Enter", "shortcuts.toggleGroups"],
  // Cmd+Esc on a Mac only: see "keys that can't work on Windows" below.
  ["Mod+Escape", "shortcuts.resetOption"],
  // In text: the rich-text editor's own (part 2).
  ["Mod+K", "shortcuts.link"],
  ["Shift+Enter", "shortcuts.newLine"],
  ["Alt+Enter", "shortcuts.splitText"],
  ["Shift+Space", "shortcuts.nonBreakingSpace"],
];

describe("the shortcut standard (F-ED-27)", () => {
  it("has every key F-ED-27 names, for what it names", () => {
    for (const [key, what] of F_ED_27) {
      const entry = COMMAND_SHORTCUTS[what] ?? OTHER_SHORTCUTS.find(({ label }) => label === what);
      const keys =
        entry === undefined ? [] : [...platformKeys(entry, true), ...platformKeys(entry, false)];
      expect(keys, `${key} for ${what}`).toContain(key);
    }
  });

  it("gives no key to two commands, on either platform", () => {
    for (const mac of [true, false]) {
      const owners = new Map<string, string>();
      for (const [id, entry] of Object.entries(COMMAND_SHORTCUTS)) {
        for (const key of platformKeys(entry, mac)) {
          expect(owners.get(key), `${key}: ${id}`).toBeUndefined();
          owners.set(key, id);
        }
      }
    }
  });

  it("names text keys among a command's own keys, and only groups the sheet shows", () => {
    for (const { keys, text, group } of Object.values(COMMAND_SHORTCUTS)) {
      expect(SHORTCUT_GROUPS).toContain(group);
      if (Array.isArray(text)) {
        for (const key of text) expect(keys).toContain(key);
      }
    }
    for (const { group } of OTHER_SHORTCUTS) expect(SHORTCUT_GROUPS).toContain(group);
  });

  it("leaves a command's keys that text has too to the text: Mod+K, Mod+I, Mod+U", () => {
    expect(COMMAND_SHORTCUTS[COMMAND_IDS.commandBox]?.text).toEqual(["Mod+K"]);
    expect(COMMAND_SHORTCUTS[COMMAND_IDS.preview]?.text).toBe(true);
    expect(COMMAND_SHORTCUTS[COMMAND_IDS.publish]?.text).toBe(true);
  });
});

/** A key with its modifiers in a fixed order, so `Shift+Mod+Escape` is `Mod+Shift+Escape`. */
function normal(key: string): string {
  const parts = key.split("+");
  const name = parts.pop() ?? "";
  const order = ["Mod", "Alt", "Shift"];
  return [...order.filter((modifier) => parts.includes(modifier)), name.toLowerCase()].join("+");
}

describe("keys that can't work on Windows (#290)", () => {
  // The product owner's rule: a shortcut that can't work on Windows is left out there or gets an
  // alternative. A new shortcut that fails here needs `macKeys` and, if it matters, `windowsKeys`.
  const reserved = new Set(WINDOWS_RESERVED_KEYS.map(normal));

  it("never gives Windows a key Windows keeps for itself", () => {
    for (const [name, entry] of EVERY_SHORTCUT) {
      for (const key of platformKeys(entry, false)) {
        expect(reserved.has(normal(key)), `${key} (${name})`).toBe(false);
      }
    }
  });

  it("gives every Ctrl+Alt+arrow an alternative on Windows, where it can rotate the screen", () => {
    for (const [name, entry] of EVERY_SHORTCUT) {
      for (const key of entry.keys.filter((each) => /^Mod\+Alt\+Arrow/.test(each))) {
        const alternative = key.replace("Mod+Alt+", "Alt+");
        expect(platformKeys(entry, false), `${key} (${name})`).toContain(alternative);
      }
    }
  });

  it("keeps Cmd+Esc for resetting an option on a Mac, and Alt+arrows moving on Windows", () => {
    const reset = OTHER_SHORTCUTS.find(({ label }) => label === "shortcuts.resetOption");
    expect(reset === undefined ? [] : platformKeys(reset, true)).toEqual(["Mod+Escape"]);
    expect(reset === undefined ? ["missing"] : platformKeys(reset, false)).toEqual([]);
    const moveUp = COMMAND_SHORTCUTS["edit.moveUp"];
    expect(moveUp === undefined ? [] : platformKeys(moveUp, false)).toEqual([
      "Mod+Alt+ArrowUp",
      "Alt+ArrowUp",
    ]);
    expect(moveUp === undefined ? [] : platformKeys(moveUp, true)).toEqual(["Mod+Alt+ArrowUp"]);
  });
});
