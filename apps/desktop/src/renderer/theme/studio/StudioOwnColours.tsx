import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  ColourPicker,
} from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n/components";
import { type Oklch, OWN_COLOR_NAME_MAX, OWN_COLORS_MAX, type OwnColor } from "@webforge/model";
import { hexOf, hexToOklch, type OwnColorIssue } from "@webforge/themes";
import { PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";
import { shownRatio, type ThemeColorPreview } from "../../fields/index.js";
import { type OwnColorUses, ROLE_NAMES } from "../theme-edits.js";

/** Props of {@link StudioOwnColours}. */
export type StudioOwnColoursProps = {
  readonly colors: readonly OwnColor[];
  /** A colour new to the list starts as: the theme's brand colour. */
  readonly startColor: Oklch;
  readonly onAdd: (name: string, color: Oklch) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onSetColor: (id: string, color: Oklch) => void;
  /** How many times colour `id` is used across the site. */
  readonly usesOf: (id: string) => number;
  readonly onDelete: (id: string, uses: OwnColorUses) => void;
  /** What shows colour `id` while it's dragged in its picker (5.30). */
  readonly preview?: ((id: string) => ThemeColorPreview) | undefined;
  /** The colours hard to read as text on a surface (`ownColorIssues`), each said under it. */
  readonly issues?: readonly OwnColorIssue[] | undefined;
};

/** What colour `id`'s contrast lacks, as its row says it: the hardest surface to read it on. */
function warningOf(issues: readonly OwnColorIssue[], id: string): string | undefined {
  const [worst] = issues.filter((issue) => issue.id === id).sort((a, b) => a.ratio - b.ratio);
  if (worst === undefined) return undefined;
  const values = {
    background: t(ROLE_NAMES[worst.background]),
    ratio: shownRatio(worst.ratio),
    needed: worst.required,
  };
  return worst.palette === "inverse"
    ? t("theme.studio.own.hardToReadReversed", values)
    : t("theme.studio.own.hardToRead", values);
}

/** A new colour's name: "Colour 1", "Colour 2"…, the first no colour has already. */
function newName(colors: readonly OwnColor[]): string {
  const taken = new Set(colors.map(({ name }) => name));
  for (let n = 1; ; n++) {
    const name = t("theme.studio.own.newName", { n });
    if (!taken.has(name)) return name;
  }
}

/** How many colours the list shows before it offers its search. */
const SEARCH_FROM = 6;

/**
 * Theme Studio › Colours' list of the person's own colours (TC-1b, #1218): their business's colours
 * beside the theme's roles, each with a name and its colour, to use in any colour field. Add,
 * rename, change and delete are each one step. A long list can be searched by name. Deleting a
 * colour in use asks what becomes of its uses: given to another of their colours, or each kept as a
 * one-off as it looks now. A colour is never lost silently. A colour hard to read as text on a
 * surface says so under it (TC-1a's `ownColorIssues`).
 */
export function StudioOwnColours(props: StudioOwnColoursProps) {
  const id = useId();
  const { colors } = props;
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<{ readonly id: string; readonly uses: number } | null>(
    null,
  );
  // A search only while its box shows: a list that shrinks below it shows every colour again.
  const search = colors.length < SEARCH_FROM ? "" : query.trim().toLowerCase();
  const shown =
    search === "" ? colors : colors.filter(({ name }) => name.toLowerCase().includes(search));
  const full = colors.length >= OWN_COLORS_MAX;
  const deleted = colors.find((each) => each.id === deleting?.id);
  const others = colors.filter((each) => each.id !== deleting?.id);
  const [replacement, setReplacement] = useState<string | undefined>(undefined);
  const to = replacement ?? others[0]?.id;

  return (
    <section aria-labelledby={`${id}-title`} className="mb-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 id={`${id}-title`} className="m-0 text-xs font-semibold">
          {t("theme.studio.own.title")}
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={full}
          onClick={() => props.onAdd(newName(colors), props.startColor)}
        >
          <PlusIcon aria-hidden />
          {t("theme.studio.own.add")}
        </Button>
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        {full
          ? t("theme.studio.own.full", { count: OWN_COLORS_MAX })
          : colors.length === 0
            ? t("theme.studio.own.none")
            : t("theme.studio.own.about")}
      </p>
      {colors.length < SEARCH_FROM ? null : (
        <input
          type="search"
          className="h-7 rounded-sm border border-border bg-input px-2 text-xs"
          aria-label={t("theme.studio.own.search")}
          placeholder={t("theme.studio.own.search")}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      )}
      {colors.length === 0 ? null : (
        <ul
          aria-label={t("theme.studio.own.title")}
          className="m-0 flex max-h-72 list-none flex-col gap-1 overflow-y-auto p-0"
        >
          {shown.map((colour) => {
            const warning = warningOf(props.issues ?? [], colour.id);
            return (
              <li key={colour.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <ColourPicker
                    value={hexOf(colour.color)}
                    aria-label={t("theme.studio.own.colour", { name: colour.name })}
                    onChoose={(hex) => props.onSetColor(colour.id, hexToOklch(hex))}
                    onPreview={(hex) => props.preview?.(colour.id).show(hexToOklch(hex))}
                    onPreviewEnd={(chosen) => props.preview?.(colour.id).end(chosen)}
                  />
                  <input
                    // A new key once renamed elsewhere (undo): the field shows the name as it is.
                    key={colour.name}
                    aria-label={t("theme.studio.own.name", { name: colour.name })}
                    defaultValue={colour.name}
                    maxLength={OWN_COLOR_NAME_MAX}
                    className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-input px-2 text-xs"
                    onBlur={(event) => {
                      const name = event.currentTarget.value.trim();
                      if (name !== "" && name !== colour.name) props.onRename(colour.id, name);
                      else event.currentTarget.value = colour.name;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("theme.studio.own.delete", { name: colour.name })}
                    onClick={() => {
                      const uses = props.usesOf(colour.id);
                      // Not used anywhere: nothing to ask, and Undo brings it back.
                      if (uses === 0) props.onDelete(colour.id, { kind: "oneOff" });
                      else {
                        setReplacement(undefined);
                        setDeleting({ id: colour.id, uses });
                      }
                    }}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
                {warning === undefined ? null : (
                  <p className="m-0 flex items-start gap-1 text-xs">
                    <TriangleAlertIcon
                      aria-hidden
                      className="mt-0.5 size-3.5 shrink-0 text-warning"
                    />
                    {warning}
                  </p>
                )}
              </li>
            );
          })}
          {shown.length === 0 ? (
            <li className="text-xs text-muted-foreground">{t("theme.studio.own.noMatch")}</li>
          ) : null}
        </ul>
      )}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("theme.studio.own.deleteTitle", { name: deleted?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {plural("theme.studio.own.used", deleting?.uses ?? 0)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {others.length === 0 ? null : (
            <label className="flex items-center gap-2 text-sm">
              {t("theme.studio.own.replaceWith")}
              <select
                value={to}
                className="h-8 rounded-sm border border-border bg-input px-2 text-sm"
                onChange={(event) => setReplacement(event.currentTarget.value)}
              >
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("theme.studio.own.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (deleting !== null) props.onDelete(deleting.id, { kind: "oneOff" });
                setDeleting(null);
              }}
            >
              {t("theme.studio.own.keep")}
            </Button>
            {to === undefined ? null : (
              <Button
                onClick={() => {
                  if (deleting !== null) props.onDelete(deleting.id, { kind: "replace", to });
                  setDeleting(null);
                }}
              >
                {t("theme.studio.own.replace")}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
