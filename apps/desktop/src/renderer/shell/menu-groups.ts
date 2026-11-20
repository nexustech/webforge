import { type MessageKey, t } from "@webforge/i18n";
import { COMMAND_IDS } from "./command-ids.js";
import type { Command, MenuEntry, MenuId } from "./commands.js";

/** The names of Edit's submenus and their items (#1016). */
type MenuKey = Extract<MessageKey, `shell.menu.edit.${string}`>;

/** An item of a submenu: its command's id, and a shorter name there when its own repeats it. */
type SubmenuItem = string | { readonly id: string; readonly label: MenuKey };

/** A submenu of a menu's own (Edit › Style, #1016): its item's id, name and commands. */
type Submenu = {
  readonly submenu: string;
  readonly label: MenuKey;
  readonly items: readonly SubmenuItem[];
};

/** An item of a group: a command's id, or a submenu of commands. */
type GroupItem = string | Submenu;

/**
 * The groups of the menus that have them, in order (#1016, #1165), none longer than seven, so a
 * menu reads in parts and fits a 600 px window. A command a menu's groups leave out comes after
 * them, in a group of its own.
 * - File: opening a site; saving it and its versions; previewing, exporting and publishing;
 *   settings; closing.
 * - Edit: undo; the clipboard; arranging; the Style, Select and Shared Section submenus; notes;
 *   find.
 * - View: searching and moving about the window; the panels; the canvas's device and outlines; its
 *   zoom; the interface's zoom; appearance and modes.
 * - Site: its settings and its look; what it's checked for and its versions.
 */
export const MENU_GROUPS: Partial<Record<MenuId, readonly (readonly GroupItem[])[]>> = {
  file: [
    [
      COMMAND_IDS.newSite,
      COMMAND_IDS.quickStart,
      COMMAND_IDS.openSite,
      COMMAND_IDS.openRecent,
      COMMAND_IDS.openSiteZip,
    ],
    [COMMAND_IDS.saveVersion, COMMAND_IDS.saveSiteZip],
    [
      COMMAND_IDS.preview,
      COMMAND_IDS.previewOnPhone,
      COMMAND_IDS.stopPhonePreview,
      COMMAND_IDS.exportSite,
      COMMAND_IDS.publish,
    ],
    [COMMAND_IDS.settings, COMMAND_IDS.aiApps],
    [COMMAND_IDS.closeSite],
  ],
  view: [
    [COMMAND_IDS.commandBox, COMMAND_IDS.nextRegion, COMMAND_IDS.previousRegion],
    [
      COMMAND_IDS.toggleLeftPanels,
      COMMAND_IDS.toggleRightPanels,
      COMMAND_IDS.toggleDrawer,
      COMMAND_IDS.undoHistory,
      COMMAND_IDS.resetPanels,
    ],
    [
      COMMAND_IDS.desktopView,
      COMMAND_IDS.tabletView,
      COMMAND_IDS.mobileView,
      COMMAND_IDS.showOutlines,
      COMMAND_IDS.elementNames,
    ],
    [COMMAND_IDS.zoomIn, COMMAND_IDS.zoomOut, COMMAND_IDS.zoomActual, COMMAND_IDS.zoomFit],
    [COMMAND_IDS.interfaceZoomIn, COMMAND_IDS.interfaceZoomOut, COMMAND_IDS.interfaceZoomReset],
    [COMMAND_IDS.theme, COMMAND_IDS.editorMode, COMMAND_IDS.editorLevel],
  ],
  site: [
    [COMMAND_IDS.siteSettings, "theme.show", "theme.studio", COMMAND_IDS.stylesheet],
    [COMMAND_IDS.siteCheck, COMMAND_IDS.versionHistory],
  ],
  edit: [
    [COMMAND_IDS.undo, COMMAND_IDS.redo],
    ["edit.cut", "edit.copy", "edit.paste", "edit.duplicate", "edit.delete"],
    ["edit.moveUp", "edit.moveDown", "edit.editText", "edit.rename", "edit.toggleHidden"],
    [
      {
        submenu: "menu.edit.style",
        label: "shell.menu.edit.style",
        items: [
          COMMAND_IDS.styleThis,
          "edit.copyStyle",
          "edit.pasteStyle",
          "edit.applyLookOnPage",
          "edit.applyLookOnSite",
        ],
      },
      {
        submenu: "menu.edit.select",
        label: "shell.menu.edit.select",
        items: ["edit.selectParent", "edit.selectChild", "edit.selectSimilar"],
      },
      {
        submenu: "menu.edit.sharedSection",
        label: "shell.menu.edit.sharedSection",
        // Its own word left out of its items' names: "Rename…", not "Rename Shared Section…".
        items: [
          "edit.saveSharedSection",
          { id: "edit.renameSharedSection", label: "shell.menu.edit.sharedSection.rename" },
          { id: "edit.deleteSharedSection", label: "shell.menu.edit.sharedSection.delete" },
          { id: "edit.detachSharedSection", label: "shell.menu.edit.sharedSection.detach" },
          COMMAND_IDS.pasteLinked,
        ],
      },
    ],
    [COMMAND_IDS.note, COMMAND_IDS.resolveNote],
    [COMMAND_IDS.findReplace],
  ],
};

/** An item of a menu, and whether a separator comes before it: it starts a group. */
export type GroupedEntry = MenuEntry & { readonly separated: boolean };

/** The id of a submenu's item, and its shorter name there, if it has one. */
const itemOf = (item: SubmenuItem) =>
  typeof item === "string" ? { id: item, label: undefined } : item;

/**
 * A submenu's item, opening its `commands` (#1016). It runs nothing, and stays enabled when they
 * all aren't, so their reasons can still be read.
 */
function submenuEntry(submenu: Submenu, commands: ReadonlyMap<string, Command>): MenuEntry {
  return {
    command: { id: submenu.submenu, label: t(submenu.label), run: () => undefined },
    submenu: submenu.items.flatMap((each) => {
      const { id, label } = itemOf(each);
      const command = commands.get(id);
      if (command === undefined) return [];
      return [label === undefined ? command : { ...command, label: t(label) }];
    }),
  };
}

/**
 * `entries` of `menu` in its groups' order, a separator before each group but the first, and its
 * own submenus gathering their commands (#1016). A menu without groups keeps the registration
 * order, with no separators. A submenu none of whose commands are registered is left out.
 */
export function inGroups(menu: MenuId | "app", entries: readonly MenuEntry[]): GroupedEntry[] {
  const groups = menu === "app" ? undefined : MENU_GROUPS[menu];
  if (groups === undefined) return entries.map((entry) => ({ ...entry, separated: false }));
  const place = new Map<string, readonly [number, number]>();
  const inSubmenu = new Map<string, Command>();
  const submenuIds = new Set<string>();
  groups.forEach((items, group) => {
    items.forEach((item, index) => {
      if (typeof item === "string") {
        place.set(item, [group, index]);
        return;
      }
      place.set(item.submenu, [group, index]);
      for (const each of item.items) submenuIds.add(itemOf(each).id);
    });
  });
  for (const { command } of entries) {
    if (submenuIds.has(command.id)) inSubmenu.set(command.id, command);
  }
  const own = groups.flatMap((items) =>
    items.flatMap((item) => (typeof item === "string" ? [] : [submenuEntry(item, inSubmenu)])),
  );
  const ranked = [
    ...entries.filter(({ command }) => !submenuIds.has(command.id)),
    ...own.filter((entry) => entry.submenu.length > 0),
  ].map((entry, order) => {
    const [group, index] = place.get(entry.command.id) ?? [groups.length, order];
    return { entry, group, index };
  });
  ranked.sort((a, b) => a.group - b.group || a.index - b.index);
  return ranked.map(({ entry, group }, at) => ({
    ...entry,
    separated: at > 0 && group !== ranked[at - 1]?.group,
  }));
}
