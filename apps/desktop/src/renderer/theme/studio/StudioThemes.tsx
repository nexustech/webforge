import { cn } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ThemeTokens } from "@webforge/model";
import { inverseColors, oklchCss, radiusCss, THEME_PRESETS } from "@webforge/themes";
import type { CSSProperties } from "react";
import { previewFamily } from "../../fields/index.js";
import { presetName } from "../theme-edits.js";

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
  const name = presetName(theme.preset);
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

/**
 * Theme Studio's themes (F-DS-7): a card per preset, live in its own colours, fonts and corners,
 * the theme's own marked. Choosing one switches to it (asked first, D7).
 */
export function StudioThemes({
  theme,
  onChoose,
}: {
  readonly theme: ThemeTokens;
  readonly onChoose: (preset: ThemeTokens) => void;
}) {
  return (
    <ul
      aria-label={t("theme.studio.section.themes")}
      className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2 p-0"
    >
      {THEME_PRESETS.map((preset) => (
        <li key={preset.preset} className="flex">
          <ThemeCard
            theme={preset}
            current={preset.preset === theme.preset}
            onChoose={() => onChoose(preset)}
          />
        </li>
      ))}
    </ul>
  );
}
