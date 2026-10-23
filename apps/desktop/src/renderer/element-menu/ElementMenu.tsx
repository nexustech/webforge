import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
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
  saveShared: "edit.saveSharedSection",
  detachShared: "edit.detachSharedSection",
  remove: "edit.delete",
} as const;

/** Props of {@link ElementMenu}. */
export type ElementMenuProps = {
  /** Where the menu is open; closed while null. */
  readonly at: MenuPoint | null;
  readonly onClose: () => void;
  /** Renames the selected element, or undefined where it has no name to give (not a layer). */
  readonly onRename: (() => void) | undefined;
};

/**
 * The selected element's right-click menu (1.35, UX-24): the same on the canvas and in Layers.
 * Rename, Duplicate, Save as shared section (or Detach, for a linked copy) and Delete. The element
 * is selected before it opens, so each item acts on it.
 */
export function ElementMenu({ at, onClose, onRename }: ElementMenuProps) {
  const registry = useCommandRegistry();
  const duplicate = useCommand(ELEMENT_MENU_COMMANDS.duplicate);
  const save = useCommand(ELEMENT_MENU_COMMANDS.saveShared);
  const detach = useCommand(ELEMENT_MENU_COMMANDS.detachShared);
  const remove = useCommand(ELEMENT_MENU_COMMANDS.remove);
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
      >
        <DropdownMenuItem disabled={onRename === undefined} onSelect={onRename}>
          {t("layers.rename")}
        </DropdownMenuItem>
        {item(duplicate)}
        {item(shared)}
        <DropdownMenuSeparator />
        {item(remove, true)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
