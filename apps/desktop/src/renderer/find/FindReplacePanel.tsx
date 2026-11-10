import { Button, fieldControlClass, ScrollArea } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import { SearchIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";

/** What the person has typed and chosen. */
export type FindState = {
  readonly query: string;
  readonly replacement: string;
  readonly matchCase: boolean;
  readonly wholeWords: boolean;
};

/** One match in the list: what it's in, the text around it, and what can be done with it. */
export type FindRow = {
  readonly key: string;
  /** What it's in: "Heading · Text", "Title". */
  readonly where: string;
  readonly before: string;
  readonly found: string;
  readonly after: string;
};

/** The matches in one place: a page, the Header, the Footer, a shared section, Site Settings. */
export type FindGroup = {
  readonly key: string;
  readonly name: string;
  readonly rows: readonly FindRow[];
};

export type FindReplacePanelProps = {
  readonly state: FindState;
  readonly onChange: (change: Partial<FindState>) => void;
  readonly groups: readonly FindGroup[];
  /** Shows where a match is: selects its element on its page, or opens its settings. */
  readonly onShow: (row: FindRow) => void;
  /** Replaces this match only. */
  readonly onReplace: (row: FindRow) => void;
  readonly onReplaceAll: () => void;
  /** Changes each time *Find* should take the focus: the command was run. */
  readonly focusRequest?: number;
};

/** How much text around a match is shown before it is cut short, each side. */
const SHOWN = 24;

/** A match with the text around it, as the list shows it: "…for Smith & Sons since…". */
const shown = (row: FindRow) =>
  `${row.before.length > SHOWN ? "…" : ""}${row.before.slice(-SHOWN)}${row.found}${row.after.slice(0, SHOWN)}${row.after.length > SHOWN ? "…" : ""}`;

/**
 * Find and Replace (6.2): finds text everywhere the owner writes it, lists each match under its
 * page with the text around it, shows where it is, and replaces one or all.
 */
export function FindReplacePanel({
  state,
  onChange,
  groups,
  onShow,
  onReplace,
  onReplaceAll,
  focusRequest = 0,
}: FindReplacePanelProps) {
  const findField = useRef<HTMLInputElement>(null);
  const ids = useId();
  useEffect(() => {
    if (focusRequest === 0) return;
    findField.current?.focus();
    findField.current?.select();
  }, [focusRequest]);
  const total = groups.reduce((count, group) => count + group.rows.length, 0);
  const status =
    state.query === ""
      ? t("findReplace.status.empty")
      : total === 0
        ? t("findReplace.status.none")
        : t("findReplace.status.found", {
            matches: plural("findReplace.matches", total),
            places: plural("findReplace.places", groups.length),
          });
  // All of it scrolls, as Site Check does: in a short bottom panel, the fields and the status
  // would otherwise leave the list no room at all.
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col text-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <div className="relative min-w-40 flex-1">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={findField}
              type="search"
              aria-label={t("findReplace.find")}
              placeholder={t("findReplace.find")}
              className={`${fieldControlClass} pl-7`}
              value={state.query}
              onChange={(event) => onChange({ query: event.target.value })}
            />
          </div>
          <input
            type="text"
            aria-label={t("findReplace.replaceWith")}
            placeholder={t("findReplace.replaceWith")}
            className={`${fieldControlClass} min-w-40 flex-1`}
            value={state.replacement}
            onChange={(event) => onChange({ replacement: event.target.value })}
          />
          <label className="flex items-center gap-1.5" htmlFor={`${ids}-case`}>
            <input
              id={`${ids}-case`}
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={state.matchCase}
              onChange={(event) => onChange({ matchCase: event.target.checked })}
            />
            {t("findReplace.matchCase")}
          </label>
          <label className="flex items-center gap-1.5" htmlFor={`${ids}-words`}>
            <input
              id={`${ids}-words`}
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={state.wholeWords}
              onChange={(event) => onChange({ wholeWords: event.target.checked })}
            />
            {t("findReplace.wholeWords")}
          </label>
          <Button size="sm" variant="outline" disabled={total === 0} onClick={onReplaceAll}>
            {t("findReplace.replaceAll")}
          </Button>
        </div>
        <p role="status" className="m-0 px-3 pt-2 text-muted-foreground">
          {status}
        </p>
        <div className="flex flex-col gap-3 p-3">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`${ids}-${group.key}`}>
              <h3
                id={`${ids}-${group.key}`}
                className="mb-1 text-xs font-semibold text-muted-foreground uppercase"
              >
                {group.name}
              </h3>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {group.rows.map((row) => (
                  <li key={row.key} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate rounded px-1 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      onClick={() => onShow(row)}
                    >
                      <span className="text-muted-foreground">{row.where}: </span>
                      {row.before.length > SHOWN ? "…" : ""}
                      {row.before.slice(-SHOWN)}
                      <mark className="rounded-sm bg-primary/20 text-foreground">{row.found}</mark>
                      {row.after.slice(0, SHOWN)}
                      {row.after.length > SHOWN ? "…" : ""}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t("findReplace.replaceOneLabel", {
                        text: shown(row),
                        page: group.name,
                      })}
                      onClick={() => onReplace(row)}
                    >
                      {t("findReplace.replaceOne")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
