import type { MessageKey } from "@webforge/i18n";
import { COMMAND_IDS } from "./command-ids.js";

/**
 * The keyboard shortcut standard (F-ED-27, UI3): Bootstrap Studio's keys on Windows and macOS,
 * `Mod` being Ctrl on Windows and Cmd on macOS. Every command's keys come from here, not from the
 * area that registers it (the registry looks them up by id), so menus, tooltips, the command box
 * and the *Keyboard shortcuts* sheet can't disagree. Keys for commands that don't exist yet
 * (Preview, Publish, Save version, Paste as linked copy) are kept for them here.
 *
 * A key is `Mod+Alt+Shift+Name`, the name being `KeyboardEvent.key` (`ArrowUp`, `Backspace`, `/`)
 * or `Plus` for `+` and `Space` for a space. Symbols match whichever Shift their keyboard layout
 * needs (`?`, `Mod+0` on AZERTY).
 *
 * New `Mod+Alt` shortcuts: avoid letters whose key moves on other layouts, A, Q, Z and W on AZERTY,
 * Y and Z on QWERTZ. Keys match by `KeyboardEvent.key`, so such a shortcut moves across the
 * keyboard on those layouts, away from where a guide written for QWERTY says it is.
 */

/** Where the sheet lists a shortcut. */
export type ShortcutGroup = "site" | "edit" | "select" | "view" | "text" | "layers" | "editPanel";

/** The groups in the order the sheet shows them. */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  "site",
  "edit",
  "select",
  "view",
  "text",
  "layers",
  "editPanel",
];

/** A command's shortcut in the standard. */
export type StandardShortcut = {
  readonly group: ShortcutGroup;
  /**
   * Keys that run it. Menus show the first one the keyboard has: a Mac keyboard has no Delete
   * key, so Delete's own command shows Mod+Backspace there.
   */
  readonly keys: readonly string[];
  /**
   * The keys that are text's own too (Copy, Mod+K for a link, Mod+I for italic): they don't run
   * the command while focus is in editable text or text is selected, so the text gets them. `true`
   * for all of them.
   */
  readonly text?: true | readonly string[];
};

/** The canvas's actions (1.12, 1.30, 1.31). Arrows and Mod+arrows are the caret's in text. */
const CANVAS: Readonly<Record<string, StandardShortcut>> = {
  "edit.duplicate": { group: "edit", keys: ["Mod+D"] },
  // Mod+Backspace deletes too, as Cmd+Delete does in a Mac's Finder (decision of 23 Oct 2026).
  "edit.delete": { group: "edit", keys: ["Delete", "Mod+Backspace"], text: true },
  "edit.moveUp": { group: "edit", keys: ["Mod+Alt+ArrowUp"], text: true },
  "edit.moveDown": { group: "edit", keys: ["Mod+Alt+ArrowDown"], text: true },
  "edit.editText": { group: "edit", keys: ["Enter"] },
  "edit.clearText": { group: "edit", keys: ["Backspace"] },
  "edit.selectParent": { group: "select", keys: ["Mod+ArrowUp"], text: true },
  "edit.selectChild": { group: "select", keys: ["Mod+ArrowDown"], text: true },
  "edit.selectPreviousSibling": { group: "select", keys: ["Mod+ArrowLeft"], text: true },
  "edit.selectNextSibling": { group: "select", keys: ["Mod+ArrowRight"], text: true },
  "edit.selectPrevious": { group: "select", keys: ["ArrowUp"] },
  "edit.selectNext": { group: "select", keys: ["ArrowDown"] },
};

/** Every command's shortcut, by command id. */
export const COMMAND_SHORTCUTS: Readonly<Record<string, StandardShortcut>> = {
  [COMMAND_IDS.newSite]: { group: "site", keys: ["Mod+N"] },
  [COMMAND_IDS.openSite]: { group: "site", keys: ["Mod+O"] },
  [COMMAND_IDS.preview]: { group: "site", keys: ["Mod+I"], text: true },
  [COMMAND_IDS.exportSite]: { group: "site", keys: ["Mod+E"] },
  [COMMAND_IDS.publish]: { group: "site", keys: ["Mod+U"], text: true },
  [COMMAND_IDS.saveVersion]: { group: "site", keys: ["Mod+Alt+S"] },
  [COMMAND_IDS.undo]: { group: "edit", keys: ["Mod+Z"] },
  // Ctrl+Y as on Windows; the history's own keys take both everywhere (U4).
  [COMMAND_IDS.redo]: { group: "edit", keys: ["Mod+Shift+Z", "Mod+Y"] },
  "edit.cut": { group: "edit", keys: ["Mod+X"], text: true },
  "edit.copy": { group: "edit", keys: ["Mod+C"], text: true },
  "edit.paste": { group: "edit", keys: ["Mod+V"], text: true },
  [COMMAND_IDS.pasteLinked]: { group: "edit", keys: ["Mod+Shift+V"], text: true },
  "edit.copyStyle": { group: "edit", keys: ["Mod+Alt+C"] },
  "edit.pasteStyle": { group: "edit", keys: ["Mod+Alt+V"] },
  "edit.toggleHidden": { group: "edit", keys: ["Mod+/"], text: true },
  "edit.rename": { group: "edit", keys: ["F2"] },
  ...CANVAS,
  // Mod+K was the command box's first key: kept, but in text it makes a link.
  [COMMAND_IDS.commandBox]: { group: "view", keys: ["Mod+P", "Mod+K"], text: ["Mod+K"] },
  [COMMAND_IDS.zoomIn]: { group: "view", keys: ["Mod+=", "Mod+Plus"] },
  [COMMAND_IDS.zoomOut]: { group: "view", keys: ["Mod+-"] },
  [COMMAND_IDS.zoomActual]: { group: "view", keys: ["Mod+0"] },
  [COMMAND_IDS.zoomFit]: { group: "view", keys: ["Mod+9"] },
  [COMMAND_IDS.desktopView]: { group: "view", keys: ["Mod+1"] },
  [COMMAND_IDS.tabletView]: { group: "view", keys: ["Mod+2"] },
  [COMMAND_IDS.mobileView]: { group: "view", keys: ["Mod+3"] },
  [COMMAND_IDS.toggleLeftPanels]: { group: "view", keys: ["Mod+Alt+B"] },
  [COMMAND_IDS.toggleDrawer]: { group: "view", keys: ["Mod+J"] },
  [COMMAND_IDS.shortcuts]: { group: "view", keys: ["?"] },
};

/** A shortcut that isn't a command's: something else handles its keys, so only the sheet lists it. */
export type OtherShortcut = {
  readonly label: MessageKey;
  readonly group: ShortcutGroup;
  readonly keys: readonly string[];
};

/**
 * Keys handled outside the command registry: the main process saves on Mod+S (P2), the rich-text
 * editor takes the text keys, the Layers tree its own (WAI-ARIA's tree pattern), and the Edit panel
 * its option groups' (on the group or field that has the focus).
 */
export const OTHER_SHORTCUTS: readonly OtherShortcut[] = [
  { label: "shortcuts.saveNow", group: "site", keys: ["Mod+S"] },
  { label: "shortcuts.cancelDrag", group: "edit", keys: ["Escape"] },
  { label: "shortcuts.bold", group: "text", keys: ["Mod+B"] },
  { label: "shortcuts.italic", group: "text", keys: ["Mod+I"] },
  { label: "shortcuts.newLine", group: "text", keys: ["Shift+Enter"] },
  { label: "shortcuts.link", group: "text", keys: ["Mod+K"] },
  { label: "shortcuts.splitText", group: "text", keys: ["Alt+Enter"] },
  { label: "shortcuts.nonBreakingSpace", group: "text", keys: ["Shift+Space"] },
  { label: "shortcuts.layersFocus", group: "layers", keys: ["ArrowUp", "ArrowDown"] },
  { label: "shortcuts.layersOpen", group: "layers", keys: ["ArrowRight", "ArrowLeft"] },
  { label: "shortcuts.layersParent", group: "layers", keys: ["Mod+ArrowUp"] },
  { label: "shortcuts.layersChild", group: "layers", keys: ["Mod+ArrowDown"] },
  { label: "shortcuts.layersSibling", group: "layers", keys: ["Mod+ArrowLeft", "Mod+ArrowRight"] },
  {
    label: "shortcuts.layersMove",
    group: "layers",
    keys: ["Mod+Alt+ArrowUp", "Mod+Alt+ArrowDown"],
  },
  // Held while dragging a layer (1.35). Shift for a linked copy works once the drag has started.
  { label: "shortcuts.layersCopy", group: "layers", keys: ["Mod"] },
  { label: "shortcuts.layersLinkedCopy", group: "layers", keys: ["Mod+Shift"] },
  { label: "shortcuts.layersRename", group: "layers", keys: ["F2"] },
  { label: "shortcuts.layersDelete", group: "layers", keys: ["Delete", "Backspace"] },
  // The Edit panel's option groups (1.36, UX-13): its own keys, on a group's title or in a field.
  { label: "shortcuts.toggleGroups", group: "editPanel", keys: ["Mod+Enter"] },
  { label: "shortcuts.resetOption", group: "editPanel", keys: ["Mod+Escape"] },
];
