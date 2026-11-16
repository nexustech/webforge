import { COMMAND_IDS } from "./command-ids.js";
import type { MenuEntry, MenuId } from "./commands.js";

/**
 * The groups of the menus that have them, in order, each by its commands' ids in the order it
 * lists them (#1016). Edit's: undo; the clipboard; style; arranging; selecting; shared sections;
 * notes; find. A command a menu's groups leave out comes after them, in a group of its own.
 */
const MENU_GROUPS: Partial<Record<MenuId, readonly (readonly string[])[]>> = {
  edit: [
    [COMMAND_IDS.undo, COMMAND_IDS.redo],
    [
      "edit.cut",
      "edit.copy",
      "edit.paste",
      COMMAND_IDS.pasteLinked,
      "edit.duplicate",
      "edit.delete",
    ],
    [
      "edit.copyStyle",
      "edit.pasteStyle",
      COMMAND_IDS.styleThis,
      "edit.applyLookOnPage",
      "edit.applyLookOnSite",
    ],
    ["edit.moveUp", "edit.moveDown", "edit.editText", "edit.rename", "edit.toggleHidden"],
    ["edit.selectParent", "edit.selectChild", "edit.selectSimilar"],
    [
      "edit.saveSharedSection",
      "edit.renameSharedSection",
      "edit.detachSharedSection",
      "edit.deleteSharedSection",
    ],
    [COMMAND_IDS.note, COMMAND_IDS.resolveNote],
    [COMMAND_IDS.findReplace],
  ],
};

/** An item of a menu, and whether a separator comes before it: it starts a group. */
export type GroupedEntry = MenuEntry & { readonly separated: boolean };

/**
 * `entries` of `menu` in its groups' order, a separator before each group but the first (#1016).
 * A menu without groups keeps the registration order, with no separators.
 */
export function inGroups(menu: MenuId | "app", entries: readonly MenuEntry[]): GroupedEntry[] {
  const groups = menu === "app" ? undefined : MENU_GROUPS[menu];
  if (groups === undefined) return entries.map((entry) => ({ ...entry, separated: false }));
  const place = new Map(
    groups.flatMap((ids, group) => ids.map((id, index) => [id, [group, index] as const])),
  );
  const ranked = entries.map((entry, order) => {
    const [group, index] = place.get(entry.command.id) ?? [groups.length, order];
    return { entry, group, index };
  });
  ranked.sort((a, b) => a.group - b.group || a.index - b.index);
  return ranked.map(({ entry, group }, at) => ({
    ...entry,
    separated: at > 0 && group !== ranked[at - 1]?.group,
  }));
}
