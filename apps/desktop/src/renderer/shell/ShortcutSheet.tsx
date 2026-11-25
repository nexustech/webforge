import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  fieldControlClass,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { SearchIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { SheetGroups } from "./SheetGroups.js";
import { OTHER_SHORTCUTS } from "./shortcut-standard.js";

/**
 * Help → Keyboard Shortcuts, and `?` (F-ED-27): every shortcut, by what it is for, generated from
 * the command registry and the shortcut standard so it can't disagree with the menus. Registers its
 * own command. Without the editor (the start screen), only the commands' keys: saving, text and
 * Layers aren't there. A search box at the top filters it by a shortcut's name or keys (#1410).
 */
export function ShortcutSheet({ editor = true }: { readonly editor?: boolean }) {
  const registry = useCommandRegistry();
  const commands = useCommands();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const field = useRef<HTMLInputElement>(null);
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Opened again, it lists every shortcut.
        if (!next) setSearch("");
      }}
    >
      {/* As high whatever the search leaves, so the box doesn't move while people type; wider on a
          wide window, for three columns, and never wider than the window. */}
      <DialogContent
        className="h-[min(40rem,var(--dialog-max-height))] content-start sm:max-w-[min(48rem,calc(100%-2rem))] lg:max-w-[min(64rem,calc(100%-2rem))]"
        onEscapeKeyDown={(event) => {
          // Esc clears the search first, then closes.
          if (search !== "") {
            event.preventDefault();
            setSearch("");
            field.current?.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
          <DialogDescription>{t("shortcuts.description")}</DialogDescription>
        </DialogHeader>
        {/* Stays at the top while the shortcuts scroll under it. */}
        <div className="sticky top-0 z-10 -mx-4 -my-1 bg-card px-4 py-1">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-6 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={field}
            type="search"
            aria-label={t("shortcuts.search")}
            aria-controls={`${id}-groups`}
            placeholder={t("shortcuts.search")}
            className={`${fieldControlClass} pl-7`}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </div>
        {open && (
          <div id={`${id}-groups`}>
            <SheetGroups
              commands={commands}
              idPrefix={id}
              others={editor ? OTHER_SHORTCUTS : []}
              search={search}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
