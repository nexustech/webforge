import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useId, useState } from "react";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { SheetGroups } from "./SheetGroups.js";
import { OTHER_SHORTCUTS } from "./shortcut-standard.js";

/**
 * Help → Keyboard Shortcuts, and `?` (F-ED-27): every shortcut, by what it is for, generated from
 * the command registry and the shortcut standard so it can't disagree with the menus. Registers its
 * own command. Without the editor (the start screen), only the commands' keys: saving, text and
 * Layers aren't there.
 */
export function ShortcutSheet({ editor = true }: { readonly editor?: boolean }) {
  const registry = useCommandRegistry();
  const commands = useCommands();
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.shortcuts,
        label: t("command.shortcuts"),
        menu: "help",
        run: () => setOpen(true),
      }),
    [registry],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
          <DialogDescription>{t("shortcuts.description")}</DialogDescription>
        </DialogHeader>
        {open && (
          <SheetGroups commands={commands} idPrefix={id} others={editor ? OTHER_SHORTCUTS : []} />
        )}
      </DialogContent>
    </Dialog>
  );
}
