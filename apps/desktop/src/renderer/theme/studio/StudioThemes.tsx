import { Button, cn } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ThemeTokens } from "@webforge/model";
import { inverseColors, oklchCss, radiusCss, THEME_PRESETS } from "@webforge/themes";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type CSSProperties, useId } from "react";
import type { OwnTheme } from "../../../shared/ipc/themes.js";
import { previewFamily } from "../../fields/index.js";
import { themeName } from "../theme-edits.js";

/** A theme's colours, fonts and corners as CSS variables, for its card's preview. */
function cardStyle(theme: ThemeTokens): CSSProperties {
  const reversed = inverseColors(theme);
  return {
    "--surface": oklchCss(theme.colors["base-100"]),
    "--text": oklchCss(theme.colors["base-content"]),
    "--brand": oklchCss(theme.colors.primary),
    "--on-brand": oklchCss(theme.colors["primary-content"]),
    "--accent": oklchCss(theme.colors.secondary),
    "--second-accent": oklchCss(theme.colors.accent),
    "--reversed": oklchCss(reversed["base-100"]),
    "--on-reversed": oklchCss(reversed["base-content"]),
    "--reversed-brand": oklchCss(reversed.primary),
    "--field-radius": radiusCss(theme.radius.field),
    "--box-radius": radiusCss(theme.radius.box),
  } as CSSProperties;
}

/**
 * A theme's card (F-DS-7): a small page in its colours, fonts and corners, a heading, a line of
 * text and a button, then a reversed band in its reversed sections' colours, and its name.
 */
function ThemeCard({
  theme,
  current,
  onChoose,
}: {
  readonly theme: ThemeTokens;
  readonly current: boolean;
  readonly onChoose: () => void;
}) {
  const name = themeName(theme);
  return (
    <button
      type="button"
      aria-pressed={current}
      onClick={onChoose}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-md border border-border p-1.5 text-left hover:bg-hover",
        "focus-visible:outline-2 focus-visible:outline-ring",
        current && "border-primary ring-2 ring-primary",
      )}
    >
      <span
        aria-hidden
        className="flex flex-col overflow-hidden rounded-(--box-radius) border border-border"
        style={cardStyle(theme)}
      >
        <span className="flex flex-col gap-1 bg-(--surface) p-2.5 text-(--text)">
          <span
            className="truncate text-base font-bold leading-tight"
            style={{ fontFamily: previewFamily(theme.fonts.heading) }}
          >
            {t("theme.studio.cardHeading")}
          </span>
          <span
            className="truncate text-2xs"
            style={{ fontFamily: previewFamily(theme.fonts.body) }}
          >
            {t("theme.studio.cardText")}
          </span>
          <span className="mt-0.5 flex items-center gap-1">
            <span className="rounded-(--field-radius) bg-(--brand) px-2 py-0.5 text-2xs text-(--on-brand)">
              {t("theme.studio.cardButton")}
            </span>
            <span className="ml-auto size-3 rounded-full bg-(--accent)" />
            <span className="size-3 rounded-full bg-(--second-accent)" />
          </span>
        </span>
        <span className="flex items-center gap-1 bg-(--reversed) px-2.5 py-1.5 text-2xs text-(--on-reversed)">
          <span className="truncate">{t("theme.studio.cardReversed")}</span>
          <span className="ml-auto size-3 rounded-full bg-(--reversed-brand)" />
        </span>
      </span>
      <span className="flex items-center gap-1 px-0.5 text-xs">
        <span className="truncate font-medium">{name}</span>
        {current ? (
          <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
            {t("theme.studio.current")}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Props of {@link StudioThemes}. */
type StudioThemesProps = {
  /** The site's theme. */
  readonly theme: ThemeTokens;
  /** The person's own themes (2.23), listed first; none without My themes. */
  readonly own?: readonly OwnTheme[];
  /** Uses a theme: one of the person's own or a built-in one (asked first, D7). */
  readonly onChoose: (theme: ThemeTokens) => void;
  /** *New theme…*: starts one of the person's own; not offered without it. */
  readonly onNew?: () => void;
  /** Renames one of the person's own themes. */
  readonly onRename?: (theme: OwnTheme) => void;
  /** Deletes one of the person's own themes from this computer. */
  readonly onDelete?: (theme: OwnTheme) => void;
};

/** A heading over a group of theme cards. */
function GroupHeading({ id, children }: { readonly id: string; readonly children: string }) {
  return (
    <h3 id={id} className="m-0 px-1 pt-1 text-xs font-semibold text-muted-foreground">
      {children}
    </h3>
  );
}

/** The grid the theme cards are in, named by its heading. */
const GRID = "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2 p-1";

/**
 * Theme Studio's themes (F-DS-7): a card per theme, live in its own colours, fonts and corners, the
 * site's own marked. The person's own themes come first (2.23, PH2-17), each with Rename and
 * Delete, after *New theme…*; then the built-in ones, which are read-only. Choosing one switches to
 * it (asked first, D7).
 */
export function StudioThemes({
  theme,
  own = [],
  onChoose,
  onNew,
  onRename,
  onDelete,
}: StudioThemesProps) {
  const mine = onNew !== undefined || own.length > 0;
  const mineId = useId();
  const builtInId = useId();
  return (
    <div className="flex flex-col gap-2">
      {mine ? (
        <section aria-labelledby={mineId} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <GroupHeading id={mineId}>{t("theme.own.mine")}</GroupHeading>
            {onNew === undefined ? null : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                aria-haspopup="dialog"
                onClick={onNew}
              >
                <PlusIcon aria-hidden className="size-3.5" />
                {t("theme.own.new")}
              </Button>
            )}
          </div>
          {own.length === 0 ? (
            <p className="m-0 px-1 text-xs text-muted-foreground">{t("theme.own.none")}</p>
          ) : (
            <ul aria-labelledby={mineId} className={GRID}>
              {own.map((each) => (
                <li key={each.own.id} className="flex flex-col gap-0.5">
                  <ThemeCard
                    theme={each}
                    current={theme.own?.id === each.own.id}
                    onChoose={() => onChoose(each)}
                  />
                  <span className="flex justify-end gap-0.5">
                    {onRename === undefined ? null : (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("theme.own.rename", { name: each.own.name })}
                        title={t("theme.own.rename", { name: each.own.name })}
                        aria-haspopup="dialog"
                        onClick={() => onRename(each)}
                      >
                        <PencilIcon aria-hidden />
                      </Button>
                    )}
                    {onDelete === undefined ? null : (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("theme.own.delete", { name: each.own.name })}
                        title={t("theme.own.delete", { name: each.own.name })}
                        aria-haspopup="dialog"
                        onClick={() => onDelete(each)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <section aria-labelledby={builtInId} className="flex flex-col gap-1">
        {mine ? <GroupHeading id={builtInId}>{t("theme.own.builtIn")}</GroupHeading> : null}
        <ul
          aria-label={mine ? undefined : t("theme.studio.section.themes")}
          aria-labelledby={mine ? builtInId : undefined}
          // Room around the cards for the chosen one's ring.
          className={GRID}
        >
          {THEME_PRESETS.map((preset) => (
            <li key={preset.preset} className="flex">
              <ThemeCard
                theme={preset}
                current={theme.own === undefined && preset.preset === theme.preset}
                onChoose={() => onChoose(preset)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
