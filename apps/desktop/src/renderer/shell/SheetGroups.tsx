import { type MessageKey, plural, t } from "@webforge/i18n";
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
type SheetRow = { readonly label: string; readonly keys: readonly string[] };

/** The sheet: its groups, each with its lines. */
export type Sheet = readonly {
  readonly group: ShortcutGroup;
  readonly rows: readonly SheetRow[];
}[];

/**
 * The sheet's groups and lines: the registered commands with keys, by their group in the standard,
 * then the keys handled elsewhere (saving, text, Layers). Made from the registry, so the sheet lists
 * what the menus show, and nothing that isn't there yet.
 */
export function shortcutSheet(
  commands: readonly Command[],
  mac: boolean,
  others: readonly OtherShortcut[] = OTHER_SHORTCUTS,
): Sheet {
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
 * Modifiers by the names people search for them, so a Mac's symbols and their spelled names match
 * each other (`⌘Z`, `cmd+z`), and Option is also Alt.
 */
const MODIFIER_NAMES: Readonly<Record<string, string>> = {
  "⌘": "cmd",
  command: "cmd",
  "⌥": "alt",
  option: "alt",
  opt: "alt",
  "⇧": "shift",
  "⌃": "ctrl",
  control: "ctrl",
};

/**
 * A key's parts as the search compares them: `Ctrl+Alt+S` is `ctrl`, `alt`, `s`, and a Mac's `⇧⌘Z`
 * is `shift`, `cmd`, `z`.
 */
const keyParts = (key: string) =>
  key
    .toLocaleLowerCase()
    .replaceAll(/\s/g, "")
    .replaceAll(/([⌘⌥⇧⌃])/gu, "$1+")
    .split("+")
    .filter((part) => part !== "")
    .map((part) => MODIFIER_NAMES[part] ?? part);

/**
 * Whether a key is what was searched for. One word is in any of its parts (`del`, `ctrl`). More
 * are all among its parts, in any order, as a Mac writes its modifiers in its own: `Ctrl+Z` finds
 * `Ctrl+Shift+Z` too, as `⌘Z` finds `⇧⌘Z`, and `Alt+S` finds `Ctrl+Alt+S`, but `Ctrl+B` doesn't
 * find `Ctrl+Backspace`.
 */
function keyMatches(key: string, query: readonly string[]): boolean {
  const parts = keyParts(key);
  const [word] = query;
  if (query.length === 1 && word !== undefined) return parts.some((part) => part.includes(word));
  return query.every((part) => parts.includes(part));
}

/**
 * The sheet's lines whose name or keys hold what was searched for, ignoring case, under the
 * headings of the groups that still have some.
 */
export function filterSheet(sheet: Sheet, search: string): Sheet {
  const name = search.trim().toLocaleLowerCase();
  if (name === "") return sheet;
  const keys = keyParts(name);
  const matches = (row: SheetRow) =>
    row.label.toLocaleLowerCase().includes(name) ||
    (keys.length > 0 && row.keys.some((key) => keyMatches(key, keys)));
  return sheet
    .map(({ group, rows }) => ({ group, rows: rows.filter(matches) }))
    .filter(({ rows }) => rows.length > 0);
}

/**
 * The sheet's groups, in as many columns as fit (three, two or one), filtered by a search. A row's
 * second key goes under its first when there isn't room beside it, so no row is wider than its
 * column and the sheet never scrolls sideways (#1410).
 */
export function SheetGroups({
  commands,
  idPrefix,
  mac = isMac(),
  others = OTHER_SHORTCUTS,
  search = "",
}: {
  readonly commands: readonly Command[];
  readonly idPrefix: string;
  readonly mac?: boolean;
  readonly others?: readonly OtherShortcut[];
  /** What the sheet's search box holds. */
  readonly search?: string;
}) {
  const groups = filterSheet(shortcutSheet(commands, mac, others), search);
  const query = search.trim();
  const found = groups.reduce((count, { rows }) => count + rows.length, 0);
  return (
    <div className="@container">
      {/* How many match, read out as the person types; the rows themselves aren't. */}
      <p role="status" className="sr-only">
        {query === ""
          ? ""
          : found === 0
            ? t("shortcuts.noMatch", { query })
            : plural("shortcuts.match", found)}
      </p>
      {query !== "" && found === 0 ? (
        <p className="m-0 py-4 text-center text-sm text-muted-foreground">
          {t("shortcuts.noMatch", { query })}
        </p>
      ) : null}
      <div className="columns-1 gap-8 @lg:columns-2 @4xl:columns-3">
        {groups.map(({ group, rows }) => (
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
                  <dt className="min-w-0 text-muted-foreground">{row.label}</dt>
                  <dd className="flex flex-wrap justify-end gap-x-1 gap-y-0.5 text-right">
                    {row.keys.map((key, index) => (
                      // A key with the "or" before it, kept together when the second wraps.
                      <span key={key} className="whitespace-nowrap">
                        {index > 0 && (
                          <span className="pe-1 text-muted-foreground">{t("keys.or")}</span>
                        )}
                        <kbd className="rounded border border-border bg-muted px-1 font-sans">
                          {key}
                        </kbd>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
