import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { type MessageKey, t } from "@webforge/i18n";
import { Fragment, useEffect, useId, useState } from "react";
import { useCommandRegistry, useCommands } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { type Command, formatShortcut, isMac, onKeyboard } from "./commands.js";
import {
  COMMAND_SHORTCUTS,
  OTHER_SHORTCUTS,
  type OtherShortcut,
  platformKeys,
  SHORTCUT_GROUPS,
  type ShortcutGroup,
} from "./shortcut-standard.js";

const GROUP_LABELS: Readonly<Record<ShortcutGroup, MessageKey>> = {
  site: "shortcuts.group.site",
  edit: "shortcuts.group.edit",
  select: "shortcuts.group.select",
  view: "shortcuts.group.view",
  text: "shortcuts.group.text",
  layers: "shortcuts.group.layers",
  editPanel: "shortcuts.group.editPanel",
};

/** One line of the sheet: what the keys do, and the keys (any of them), as people read them. */
export type SheetRow = { readonly label: string; readonly keys: readonly string[] };

/**
 * The sheet's groups and lines: the registered commands with keys, by their group in the standard,
 * then the keys handled elsewhere (saving, text, Layers). Made from the registry, so the sheet lists
 * what the menus show, and nothing that isn't there yet.
 */
export function shortcutSheet(
  commands: readonly Command[],
  mac: boolean,
  others: readonly OtherShortcut[] = OTHER_SHORTCUTS,
): readonly { readonly group: ShortcutGroup; readonly rows: readonly SheetRow[] }[] {
  const shown = (keys: readonly string[]) =>
    keys.filter((key) => onKeyboard(key, mac)).map((key) => formatShortcut(key, mac));
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    rows: [
      ...commands
        .filter(
          (command) =>
            command.shortcut !== undefined && COMMAND_SHORTCUTS[command.id]?.group === group,
        )
        .map((command) => ({
          label: command.label,
          keys: shown([command.shortcut ?? "", ...(command.extraShortcuts ?? [])]),
        })),
      ...others
        .filter((entry) => entry.group === group)
        .map((entry) => ({
          label: t(entry.label),
          keys: shown(platformKeys(entry, mac)),
        }))
        // A shortcut with no key on this platform (Cmd+Esc on Windows, #290) isn't listed.
        .filter((row) => row.keys.length > 0),
    ],
  })).filter(({ rows }) => rows.length > 0);
}

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

/** The sheet's groups, in two columns. */
export function SheetGroups({
  commands,
  idPrefix,
  mac = isMac(),
  others = OTHER_SHORTCUTS,
}: {
  readonly commands: readonly Command[];
  readonly idPrefix: string;
  readonly mac?: boolean;
  readonly others?: readonly OtherShortcut[];
}) {
  return (
    <div className="columns-1 gap-8 sm:columns-2">
      {shortcutSheet(commands, mac, others).map(({ group, rows }) => (
        <section
          key={group}
          aria-labelledby={`${idPrefix}-${group}`}
          className="mb-4 break-inside-avoid"
        >
          <h3 id={`${idPrefix}-${group}`} className="mb-1 text-xs font-semibold">
            {t(GROUP_LABELS[group])}
          </h3>
          <dl className="text-xs">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 py-0.5">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="shrink-0 text-right">
                  {row.keys.map((key, index) => (
                    <Fragment key={key}>
                      {index > 0 && (
                        <span className="px-1 text-muted-foreground">{t("keys.or")}</span>
                      )}
                      <kbd className="rounded border border-border bg-muted px-1 font-sans">
                        {key}
                      </kbd>
                    </Fragment>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
