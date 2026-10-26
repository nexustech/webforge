import { cn, fieldControlClass } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  LINK_UNDERLINES,
  TEXT_SIZES,
  TEXT_STYLES,
  type TextStyle,
  type ThemeTokens,
} from "@webforge/model";
import { oklchCss } from "@webforge/themes";
import { type CSSProperties, useId } from "react";
import { previewFamily, TEXT_PX } from "../../fields/index.js";

/** A text style's step, as the type scale keeps it. */
type TextStep = ThemeTokens["typeScale"][TextStyle];

/** The weights a text style takes, lightest first. */
const WEIGHTS = [300, 400, 500, 600, 700, 800] as const;

/** The line heights a text style takes. */
const LEADINGS = ["tight", "normal", "relaxed"] as const;

/** Each line height in CSS, as Tailwind's `leading-*` has them. */
const LEADING_CSS: Readonly<Record<TextStep["leading"], number>> = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.625,
};

/** A select of `options` for one part of a text style, labelled by its row and its column. */
function StepSelect<V extends string | number>({
  labelledBy,
  value,
  options,
  onChange,
}: {
  readonly labelledBy: string;
  readonly value: V;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly onChange: (value: V) => void;
}) {
  return (
    <select
      aria-labelledby={labelledBy}
      className={cn(fieldControlClass, "h-7 w-full text-xs")}
      value={String(value)}
      onChange={(event) => {
        const chosen = options.find((option) => String(option.value) === event.currentTarget.value);
        if (chosen !== undefined) onChange(chosen.value);
      }}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Theme Studio's text (F-DS-7): each text style, Heading 1 to small text, shown in itself, with
 * its size, weight and line height; then links, their underline shown on a sample that underlines
 * them on hover too, as the site does. Each change is one step.
 */
export function StudioText({
  theme,
  onStep,
  onLinks,
}: {
  readonly theme: ThemeTokens;
  readonly onStep: (style: TextStyle, change: Partial<TextStep>) => void;
  readonly onLinks: (underline: ThemeTokens["links"]["underline"]) => void;
}) {
  const sizeId = useId();
  const weightId = useId();
  const leadingId = useId();
  const linksId = useId();
  const rowId = useId();
  const sizes = TEXT_SIZES.map((size) => ({
    value: size,
    label: t("theme.textSize.option", { px: TEXT_PX[size] }),
  }));
  const weights = WEIGHTS.map((weight) => ({
    value: weight,
    label: t(`theme.studio.weight.${weight}`),
  }));
  const leadings = LEADINGS.map((leading) => ({
    value: leading,
    label: t(`theme.studio.leading.${leading}`),
  }));
  const textColour = oklchCss(theme.colors["base-content"]);
  return (
    <div className="flex flex-col gap-4">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">{t("theme.studio.section.text")}</caption>
        <thead>
          <tr>
            <td />
            <th id={sizeId} scope="col" className="w-24 pb-1 text-left font-medium">
              {t("theme.studio.size")}
            </th>
            <th id={weightId} scope="col" className="w-28 pb-1 pl-2 text-left font-medium">
              {t("theme.studio.weight")}
            </th>
            <th id={leadingId} scope="col" className="w-28 pb-1 pl-2 text-left font-medium">
              {t("theme.studio.leading")}
            </th>
          </tr>
        </thead>
        <tbody>
          {TEXT_STYLES.map((style) => {
            const step = theme.typeScale[style];
            const heading = style.startsWith("h");
            const nameId = `${rowId}-${style}`;
            return (
              <tr key={style} className="border-t border-border">
                <th
                  id={nameId}
                  scope="row"
                  className="max-w-0 truncate py-1.5 pr-3 text-left font-normal"
                  style={{
                    fontFamily: previewFamily(heading ? theme.fonts.heading : theme.fonts.body),
                    // Shown at its size, up to a large heading's, so the row stays in the dialog.
                    fontSize: `${Math.min(TEXT_PX[step.size], 36)}px`,
                    fontWeight: step.weight,
                    lineHeight: LEADING_CSS[step.leading],
                  }}
                >
                  {t(`theme.textStyle.${style}`)}
                </th>
                <td className="py-1.5">
                  <StepSelect
                    labelledBy={`${nameId} ${sizeId}`}
                    value={step.size}
                    options={sizes}
                    onChange={(size) => onStep(style, { size })}
                  />
                </td>
                <td className="py-1.5 pl-2">
                  <StepSelect
                    labelledBy={`${nameId} ${weightId}`}
                    value={step.weight}
                    options={weights}
                    onChange={(weight) => onStep(style, { weight })}
                  />
                </td>
                <td className="py-1.5 pl-2">
                  <StepSelect
                    labelledBy={`${nameId} ${leadingId}`}
                    value={step.leading}
                    options={leadings}
                    onChange={(leading) => onStep(style, { leading })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
        <span id={linksId} className="font-medium">
          {t("theme.token.links.underline")}
        </span>
        <div className="w-40">
          <StepSelect
            labelledBy={linksId}
            value={theme.links.underline}
            options={LINK_UNDERLINES.map((underline) => ({
              value: underline,
              label: t(`theme.token.links.underline.${underline}`),
            }))}
            onChange={onLinks}
          />
        </div>
        <p
          className="m-0 rounded-sm bg-(--surface) px-2 py-1 text-(--text)"
          style={
            {
              "--surface": oklchCss(theme.colors["base-100"]),
              "--text": textColour,
              "--link": oklchCss(theme.colors.primary),
              fontFamily: previewFamily(theme.fonts.body),
            } as CSSProperties
          }
        >
          {t("theme.studio.linkBefore")}{" "}
          <span
            className={cn(
              "text-(--link) hover:underline",
              theme.links.underline === "always" && "underline",
            )}
          >
            {t("theme.studio.linkText")}
          </span>{" "}
          {t("theme.studio.linkAfter")}
        </p>
      </div>
    </div>
  );
}
