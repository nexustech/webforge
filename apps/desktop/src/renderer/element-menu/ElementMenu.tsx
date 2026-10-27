import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  useMenuDialog,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useCommand, useCommandRegistry } from "../shell/command-context.js";
import { type Command, formatShortcut } from "../shell/commands.js";

/** Where a menu opens, in the editor window's coordinates. */
export type MenuPoint = { readonly x: number; readonly y: number };

/**
 * The commands the element menu runs, in its order (1.35). They are the Edit menu's own, so an item
 * has the same label, shortcut, confirmations (D7) and undo step, and is off when its command is.
 */
export const ELEMENT_MENU_COMMANDS = {
  duplicate: "edit.duplicate",
  cut: "edit.cut",
  copy: "edit.copy",
  paste: "edit.paste",
  pasteLinked: "edit.pasteLinked",
  copyStyle: "edit.copyStyle",
  pasteStyle: "edit.pasteStyle",
  applyLookOnPage: "edit.applyLookOnPage",
  applyLookOnSite: "edit.applyLookOnSite",
  saveShared: "edit.saveSharedSection",
  detachShared: "edit.detachSharedSection",
  selectSimilar: "edit.selectSimilar",
  selectParent: "edit.selectParent",
  remove: "edit.delete",
} as const;

/** Props of {@link ElementMenu}. */
export type ElementMenuProps = {
  /** Where the menu is open; closed while null. */
  readonly at: MenuPoint | null;
  readonly onClose: () => void;
  /**
   * Opens the rename dialog for the selected element, or undefined where it has no name to give
   * (not a layer). It is called once the menu has closed ({@link useMenuDialog}), so the dialog's
   * field keeps the focus; the menu keeps the function chosen, whatever it draws after closing.
   */
  readonly onRename: (() => void) | undefined;
  /**
   * Puts the focus back where the menu was opened from (a row of Layers, the canvas) once it
   * closes without opening a dialog; the point it opens from can't take it.
   */
  readonly onCloseFocus?: () => void;
};

/**
 * The selected element's right-click menu (1.35, UX-24): the same on the canvas and in Layers.
 * Rename, Duplicate, Save as shared section (or Detach, for a linked copy), Select similar, Select
 * parent (SP-9); Cut,
 * Copy, Paste and Paste as Linked Copy (F-ED-23); Copy Style and Paste Style (1.37), and Apply Look
 * to Every… on this page or the site (2.27); and Delete.
 * The element is selected before it opens, so each item acts on it.
 */
export function ElementMenu({ at, onClose, onRename, onCloseFocus }: ElementMenuProps) {
  const registry = useCommandRegistry();
  // Rename opens its dialog as the other menus open theirs: once the menu has closed.
  const renameDialog = useMenuDialog<() => void>((rename) => rename());
  const duplicate = useCommand(ELEMENT_MENU_COMMANDS.duplicate);
  const save = useCommand(ELEMENT_MENU_COMMANDS.saveShared);
  const detach = useCommand(ELEMENT_MENU_COMMANDS.detachShared);
  const remove = useCommand(ELEMENT_MENU_COMMANDS.remove);
  const selectSimilar = useCommand(ELEMENT_MENU_COMMANDS.selectSimilar);
  const selectParent = useCommand(ELEMENT_MENU_COMMANDS.selectParent);
  const cut = useCommand(ELEMENT_MENU_COMMANDS.cut);
  const copy = useCommand(ELEMENT_MENU_COMMANDS.copy);
  const paste = useCommand(ELEMENT_MENU_COMMANDS.paste);
  const pasteLinked = useCommand(ELEMENT_MENU_COMMANDS.pasteLinked);
  const clipboard = [cut, copy, paste, pasteLinked];
  const copyStyle = useCommand(ELEMENT_MENU_COMMANDS.copyStyle);
  const pasteStyle = useCommand(ELEMENT_MENU_COMMANDS.pasteStyle);
  const applyLookOnPage = useCommand(ELEMENT_MENU_COMMANDS.applyLookOnPage);
  const applyLookOnSite = useCommand(ELEMENT_MENU_COMMANDS.applyLookOnSite);
  const style = [copyStyle, pasteStyle, applyLookOnPage, applyLookOnSite];
  // A linked copy can be detached; anything else can be saved, if it is a section.
  const shared = detach !== undefined && detach.enabled !== false ? detach : save;

  const item = (command: Command | undefined, destructive = false) =>
    command === undefined ? null : (
      <DropdownMenuItem
        variant={destructive ? "destructive" : "default"}
        disabled={command.enabled === false}
        onSelect={() => void registry.run(command.id)}
      >
        {command.label}
        {command.shortcut === undefined ? null : (
          <DropdownMenuShortcut>{formatShortcut(command.shortcut)}</DropdownMenuShortcut>
        )}
      </DropdownMenuItem>
    );

  return (
    <DropdownMenu
      open={at !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuTrigger asChild>
        {/* The point the menu opens from: the pointer, or the row it was opened for. */}
        <span
          aria-hidden
          className="pointer-events-none fixed size-0"
          style={{ left: at?.x ?? 0, top: at?.y ?? 0 }}
        />
      </DropdownMenuTrigger>
      {/* Named by its own label: the point it opens from has no name to lend it. */}
      <DropdownMenuContent
        align="start"
        aria-label={t("elementMenu.label")}
        aria-labelledby={undefined}
        onCloseAutoFocus={(event) => {
          renameDialog.onCloseAutoFocus(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          onCloseFocus?.();
        }}
      >
        <DropdownMenuItem
          disabled={onRename === undefined}
          onSelect={() => {
            if (onRename !== undefined) renameDialog.choose(onRename);
          }}
        >
          {t("layers.rename")}
        </DropdownMenuItem>
        {item(duplicate)}
        {item(shared)}
        {item(selectSimilar)}
        {item(selectParent)}
        {clipboard.every((command) => command === undefined) ? null : <DropdownMenuSeparator />}
        {item(cut)}
        {item(copy)}
        {item(paste)}
        {item(pasteLinked)}
        {style.every((command) => command === undefined) ? null : <DropdownMenuSeparator />}
        {item(copyStyle)}
        {item(pasteStyle)}
        {item(applyLookOnPage)}
        {item(applyLookOnSite)}
        <DropdownMenuSeparator />
        {item(remove, true)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
