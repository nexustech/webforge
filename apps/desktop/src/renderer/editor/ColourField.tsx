import {
  Button,
  type FieldRendererProps,
  fieldControlClass,
  registerFieldRenderer,
  SwatchField,
  type SwatchOption,
  ToggleGroup,
  ToggleGroupItem,
} from "@webforge/editor-ui";
import type { ReadonlyStore } from "@webforge/history";
import { type MessageKey, t } from "@webforge/i18n";
import {
  COLOR_ROLES,
  type ColorRef,
  type ColorRole,
  formatColorRef,
  OPACITY_STEPS,
  parseColorRef,
  SHADE_STEPS,
  SHADED_ROLES,
  type ShadeStep,
  type TextStyle,
  type ThemeTokens,
} from "@webforge/model";
import {
  AA_LARGE,
  AA_TEXT,
  contrastRatio,
  oklchCss,
  oklchToSrgb,
  resolveColorRef,
} from "@webforge/themes";
import { type CSSProperties, useId } from "react";
import { type EditorPreferences, usePreferences } from "../shell/preferences-store.js";
import type { EditorSession } from "./editor-session.js";
import { useDocument } from "./use-document.js";

/** Tailwind's text sizes in CSS pixels, as the type scale names them. */
const TEXT_PX: Readonly<Record<ThemeTokens["typeScale"][TextStyle]["size"], number>> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
  "6xl": 60,
};

/**
 * The least contrast WCAG AA asks of text in `styles` (F-DS-2): 3:1 for large text (at least 24 px,
 * or 18.66 px when bold), 4.5:1 for any other. Text set in several styles (a size per device)
 * needs what its smallest needs; text whose style isn't known, 4.5:1.
 */
export function contrastNeeded(theme: ThemeTokens, styles: readonly TextStyle[]): number {
  if (styles.length === 0) return AA_TEXT;
  return Math.max(
    ...styles.map((style) => {
      const { size, weight } = theme.typeScale[style];
      const px = TEXT_PX[size];
      return px >= 24 || (px >= 18.66 && weight >= 700) ? AA_LARGE : AA_TEXT;
    }),
  );
}

/** What the colour field needs besides its field's props. */
export type ColourFieldContext = {
  readonly session: Pick<EditorSession, "history">;
  /**
   * Advanced mode, where a field may have a colour of its own, off the theme (1.37, ADR 0009).
   * Simple mode shows such a colour, and offers the theme's in its place.
   */
  readonly advanced?: boolean | undefined;
  /**
   * The text styles of the element being edited (a Heading's h2, a Text's body; one per device if
   * they differ), which set how much contrast it needs; the stricter 4.5:1 while none is known.
   */
  readonly textStyles?: (() => readonly TextStyle[]) | undefined;
};

/**
 * The names people see for the theme's colour roles (glossary, 23 Oct 2026): Brand, Accent and the
 * second accent, Surface and Text. The model keeps daisyUI's names.
 */
const ROLE_NAMES: Partial<Record<ColorRole, MessageKey>> = {
  primary: "colour.role.brand",
  secondary: "colour.role.accent",
  accent: "colour.role.secondAccent",
  "base-100": "colour.role.surface",
  "base-content": "colour.role.text",
};

/** The base choice that stands for a field's own colour, off the theme. */
const CUSTOM = "custom";

/** A colour ref, read: `default` (the element's own colour) is the theme's text colour. */
function readRef(value: unknown): ColorRef | undefined {
  if (value === "default") return { base: { role: "base-content" } };
  return typeof value === "string" ? parseColorRef(value) : undefined;
}

/** The base swatch a ref is on: its role (or `default`, offered as the text colour), or custom. */
function baseKey(ref: ColorRef | undefined, options: readonly string[]): string | undefined {
  if (ref === undefined) return undefined;
  if ("hex" in ref.base) return CUSTOM;
  const { role } = ref.base;
  return role === "base-content" && options.includes("default") ? "default" : role;
}

/**
 * `ref` as the field stores it: the theme's text colour, plain, as `default` where the field
 * offers that (so it stays the element's own colour), anything else as a colour ref.
 */
function storedRef(ref: ColorRef, options: readonly string[]): string {
  const plainText =
    "role" in ref.base &&
    ref.base.role === "base-content" &&
    ref.shade === undefined &&
    ref.opacity === undefined;
  return plainText && options.includes("default") ? "default" : formatColorRef(ref);
}

/** The role a field option names: its own, or the text colour for `default`. */
function roleOfOption(value: string): ColorRole | undefined {
  if (value === "default") return "base-content";
  return (COLOR_ROLES as readonly string[]).includes(value) ? (value as ColorRole) : undefined;
}

const isShaded = (role: ColorRole) => (SHADED_ROLES as readonly string[]).includes(role);

/** `color` as the six lower-case hex digits a field's own colour is stored in: `#1f6feb`. */
const hexOf = (color: Parameters<typeof oklchToSrgb>[0]) => {
  const { r, g, b } = oklchToSrgb(color);
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

/**
 * A contrast ratio as the warning shows it: rounded down to one decimal, so a ratio that fails
 * never reads as the one it needs (4.46 shows as 4.4, not 4.5).
 */
export const shownRatio = (ratio: number) => (Math.floor(ratio * 10) / 10).toFixed(1);

/** A swatch's colour, as CSS. */
const swatchStyle = (colour: string): CSSProperties => ({ "--swatch": colour }) as CSSProperties;

/**
 * The Edit panel's colour field (1.37, UX-25, ADR 0009): the theme's colours as swatches, as this
 * site shows them, by their glossary names; then a shade of the one chosen, and its opacity. In
 * Advanced mode, a colour of the field's own (hex), marked off the theme, which theme changes leave
 * as it is. Below them, a warning when the colour is hard to read on the page (below what WCAG AA
 * asks of text of its size, {@link contrastNeeded}; sections all have the page's background so
 * far). Each choice is one change.
 */
export function ColourField({
  id,
  labelId,
  field,
  value,
  onChange,
  onCommit,
  session,
  advanced = false,
  textStyles,
}: FieldRendererProps & ColourFieldContext) {
  const theme = useDocument(session, (site) => site.theme);
  const shadeLabelId = useId();
  const opacityId = useId();
  const customId = useId();
  const options = (field.options ?? []).map((option) => option.value);
  const ref = readRef(value);
  const base = baseKey(ref, options);
  const hex = ref !== undefined && "hex" in ref.base ? ref.base.hex : undefined;
  const role = ref !== undefined && "role" in ref.base ? ref.base.role : undefined;

  /** One choice: the new colour, stored, and the end of the change. */
  const choose = (next: ColorRef) => {
    onChange(storedRef(next, options));
    onCommit();
  };
  const withOpacity = (next: ColorRef): ColorRef =>
    ref?.opacity === undefined ? next : { ...next, opacity: ref.opacity };

  const swatches: SwatchOption[] = (field.options ?? []).map((option) => {
    const optionRole = roleOfOption(option.value);
    if (optionRole === undefined) return option;
    const name = ROLE_NAMES[optionRole];
    return {
      value: option.value,
      label: name === undefined ? option.label : t(name),
      colour: oklchCss(theme.colors[optionRole]),
    };
  });
  // Advanced mode offers a colour of the field's own; Simple mode shows one it already has.
  if (advanced) {
    swatches.push({
      value: CUSTOM,
      label: t("colour.custom"),
      ...(hex === undefined ? {} : { colour: hex }),
    });
  }

  const shown = ref === undefined ? undefined : resolveColorRef(theme, formatColorRef(ref));
  const ratio =
    shown === undefined
      ? undefined
      : contrastRatio(shown.color, theme.colors["base-100"], shown.opacity);
  const needed = contrastNeeded(theme, textStyles?.() ?? []);

  return (
    <div className="flex flex-col gap-2">
      {hex !== undefined && !advanced ? (
        // A colour of the field's own, from Advanced mode: shown, kept, and replaceable.
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="size-4 shrink-0 rounded-full bg-(--swatch)"
            style={swatchStyle(hex)}
          />
          <span>{t("colour.customValue", { hex })}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => choose({ base: { role: "base-content" } })}
          >
            {t("colour.useTheme")}
          </Button>
        </div>
      ) : null}
      <SwatchField
        id={id}
        labelId={labelId}
        options={swatches}
        value={base}
        onChoose={(next) => {
          if (next === CUSTOM) {
            // A colour of its own starts from the one it shows now, to adjust from there.
            const start = hex ?? hexOf(shown?.color ?? theme.colors["base-content"]);
            choose(withOpacity({ base: { hex: start } }));
            return;
          }
          const nextRole = roleOfOption(next);
          if (nextRole !== undefined) choose(withOpacity({ base: { role: nextRole } }));
        }}
        warning={
          ratio === undefined || ratio >= needed
            ? undefined
            : t("field.color.lowContrast", { ratio: shownRatio(ratio), needed })
        }
      />
      {hex !== undefined && advanced ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={customId} className="text-xs text-muted-foreground">
            {t("colour.customHex")}
          </label>
          <input
            id={customId}
            type="color"
            className={`${fieldControlClass} h-7 w-16 p-0.5`}
            value={hex}
            onChange={(event) =>
              onChange(storedRef(withOpacity({ base: { hex: event.target.value } }), options))
            }
            onBlur={onCommit}
          />
          <p className="m-0 text-xs text-muted-foreground">{t("colour.offTheme")}</p>
        </div>
      ) : null}
      {role !== undefined && isShaded(role) ? (
        <div className="flex flex-col gap-1">
          <span id={shadeLabelId} className="text-xs text-muted-foreground">
            {t("colour.shade")}
          </span>
          <ToggleGroup
            type="single"
            aria-labelledby={shadeLabelId}
            className="flex w-full flex-wrap gap-0.5"
            value={ref?.shade === undefined ? "" : String(ref.shade)}
            onValueChange={(next) => {
              const shade = next === "" ? undefined : (Number(next) as ShadeStep);
              choose({
                base: { role },
                ...(shade === undefined ? {} : { shade }),
                ...(ref?.opacity === undefined ? {} : { opacity: ref.opacity }),
              });
            }}
          >
            {SHADE_STEPS.map((step) => (
              <ToggleGroupItem
                key={step}
                value={String(step)}
                aria-label={t("colour.shadeStep", { step })}
                title={t("colour.shadeStep", { step })}
                className="size-5 min-w-0 rounded-sm p-0 data-[state=on]:ring-2 data-[state=on]:ring-ring"
              >
                <span
                  aria-hidden
                  className="block size-full rounded-sm bg-(--swatch)"
                  style={swatchStyle(
                    oklchCss(
                      resolveColorRef(theme, formatColorRef({ base: { role }, shade: step }))
                        ?.color ?? theme.colors[role],
                    ),
                  )}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      {/* A colour of its own is Advanced mode's to change, its opacity too (ADR 0009). */}
      {ref === undefined || (hex !== undefined && !advanced) ? null : (
        <div className="flex items-center gap-2">
          <label htmlFor={opacityId} className="text-xs text-muted-foreground">
            {t("colour.opacity")}
          </label>
          <select
            id={opacityId}
            className={`${fieldControlClass} h-7 w-24 text-xs`}
            value={ref.opacity === undefined ? "100" : String(ref.opacity)}
            onChange={(event) => {
              const opacity = Number(event.target.value);
              choose({
                base: ref.base,
                ...(ref.shade === undefined ? {} : { shade: ref.shade }),
                ...(opacity === 100 ? {} : { opacity: opacity as (typeof OPACITY_STEPS)[number] }),
              });
            }}
          >
            {[100, ...[...OPACITY_STEPS].reverse()].map((step) => (
              <option key={step} value={step}>
                {t("colour.opacityStep", { step })}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/**
 * Makes the Edit panel draw colour fields with {@link ColourField}, in Advanced mode while
 * `preferences` say so: registered once, it follows the editor level (R9). Returns the function
 * that takes it away.
 */
export function registerColourField({
  preferences,
  ...context
}: Omit<ColourFieldContext, "advanced"> & {
  readonly preferences: ReadonlyStore<EditorPreferences>;
}): () => void {
  function SessionColourField(props: FieldRendererProps) {
    const advanced = usePreferences(
      preferences,
      (state) => state.preferences.editorLevel === "advanced",
    );
    return <ColourField {...props} {...context} advanced={advanced} />;
  }
  return registerFieldRenderer("color", SessionColourField);
}
