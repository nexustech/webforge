import { describe, expect, it } from "vitest";
import { COMMAND_IDS } from "./command-ids.js";
import { COMMAND_SHORTCUTS, OTHER_SHORTCUTS, SHORTCUT_GROUPS } from "./shortcut-standard.js";

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
  ["Mod+Enter", COMMAND_IDS.toggleGroups],
  ["Mod+Escape", COMMAND_IDS.resetOption],
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
      expect(entry?.keys, `${key} for ${what}`).toContain(key);
    }
  });

  it("gives no key to two commands", () => {
    const owners = new Map<string, string>();
    for (const [id, { keys }] of Object.entries(COMMAND_SHORTCUTS)) {
      for (const key of keys) {
        expect(owners.get(key), `${key}: ${id}`).toBeUndefined();
        owners.set(key, id);
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
