import {
  Button,
  ColourPicker,
  type FieldRenderer,
  type FieldRendererProps,
  fieldControlClass,
  SwatchField,
  type SwatchOption,
  ToggleGroup,
  ToggleGroupItem,
} from "@webforge/editor-ui";
import type { ReadonlyStore } from "@webforge/history";
import { type ComponentMessageKey, t } from "@webforge/i18n/components";
import {
  COLOR_ROLES,
  type ColorRef,
  type ColorRole,
  formatColorRef,
  OPACITY_STEPS,
  OWN_COLOR_PREFIX,
  parseColorRef,
  SHADE_STEPS,
  SHADED_ROLES,
  type ShadeStep,
  type TextStyle,
} from "@webforge/model";
import { TEXT_COLOUR_FIELDS } from "@webforge/site-components";
import {
  AA_LARGE,
  contrastNeeded,
  contrastOn,
  contrastRatio,
  hexOf,
  oklchCss,
  readableTextColour,
  resolveColorRef,
  type Surface,
} from "@webforge/themes";
import { type CSSProperties, useId } from "react";
import type { EditorSession } from "../../editor/editor-session.js";
import { useDocument } from "../../editor/use-document.js";
import { type EditorPreferences, usePreferences } from "../../shell/preferences-store.js";

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
  /**
   * What the element's text is drawn on (#670): a Reversed section's colours, or an Appearance
   * background, rather than the page's; the page's while none is known.
   */
  readonly surface?: (() => Surface) | undefined;
  /**
   * Whether the element's colour colours a drawing, not text (an Icon, Social links): graphics
   * need 3:1 (WCAG 1.4.11), whatever its text styles (#670).
   */
  readonly graphic?: (() => boolean) | undefined;
};

/**
 * The names people see for the theme's colour roles (glossary, 23 Oct 2026): Brand, Accent and the
 * second accent, Surface and Text. The model keeps daisyUI's names.
 */
const ROLE_NAMES: Partial<Record<ColorRole, ComponentMessageKey>> = {
  primary: "colour.role.brand",
  secondary: "colour.role.accent",
  accent: "colour.role.secondAccent",
  "base-100": "colour.role.surface",
  "base-content": "colour.role.text",
};

/**
 * A theme colour ref by the names people see (CT-13): "Text", "Brand, shade 100"; a role without a
 * name here, or a colour of its own, as stored. What the warning and Site Check suggest for text on
 * a gradient, one of Text, Brand, Accent and Second accent.
 */
export function colourRefName(ref: string): string {
  const parsed = parseColorRef(ref);
  const key =
    parsed !== undefined && "role" in parsed.base ? ROLE_NAMES[parsed.base.role] : undefined;
  if (parsed === undefined || key === undefined) return ref;
  const colour = t(key);
  return parsed.shade === undefined
    ? colour
    : t("colour.shadeOf", { colour, step: String(parsed.shade) });
}

/** The base choice that stands for a field's own colour, off the theme. */
const CUSTOM = "custom";

/**
 * The choice that leaves the colour as the item draws it, when a field offers it (the Appearance
 * group's colours, 2.22): no colour of its own, so no shade or opacity either. Unset is this too.
 */
const THEMES = "theme";

/**
 * A colour ref, read: `default` (the element's own colour) is the theme's text colour; a field
 * offering {@link THEMES} has none while it's that, or unset.
 */
function readRef(value: unknown, options: readonly string[]): ColorRef | undefined {
  if (
    options.includes(THEMES) &&
    (value === THEMES || value === undefined || value === "default")
  ) {
    return undefined;
  }
  if (value === "default") return { base: { role: "base-content" } };
  return typeof value === "string" ? parseColorRef(value) : undefined;
}

/** The base swatch a ref is on: its role (or `default`, offered as the text colour), or custom. */
function baseKey(ref: ColorRef | undefined, options: readonly string[]): string | undefined {
  if (ref === undefined) return undefined;
  if ("hex" in ref.base) return CUSTOM;
  if ("own" in ref.base) return `${OWN_COLOR_PREFIX}${ref.base.own}`;
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

/**
 * A contrast ratio as the warning shows it: rounded down to one decimal, so a ratio that fails
 * never reads as the one it needs (4.46 shows as 4.4, not 4.5).
 */
export const shownRatio = (ratio: number) => (Math.floor(ratio * 10) / 10).toFixed(1);

/** A swatch's colour, as CSS. */
const swatchStyle = (colour: string): CSSProperties => ({ "--swatch": colour }) as CSSProperties;

/**
 * The Edit panel's colour field (1.37, UX-25, ADR 0009): the theme's colours as swatches, as this
 * site shows them, by their glossary names, and under *Your colours* the person's own (TC-1b); then
 * a shade of the one chosen, and its opacity. In
 * Advanced mode, a colour of the field's own (hex), marked off the theme, which theme changes leave
 * as it is. Below them, a warning when the colour is hard to read on the page (below what WCAG AA
 * asks of text of its size, `contrastNeeded`, or 3:1 of an icon or logo), measured on what the
 * text is drawn on: a Reversed section's colours or an Appearance background (#670); none over a
 * picture behind the content (a section's background image, a Hero's), whose colours can't be
 * known. Each choice is one change.
 */
export function ColourField({
  id,
  labelId,
  name,
  field,
  value,
  onChange,
  onCommit,
  session,
  advanced = false,
  textStyles,
  surface: surfaceOfField,
  graphic: isGraphic,
}: FieldRendererProps<"color"> & ColourFieldContext) {
  const theme = useDocument(session, (site) => site.theme);
  const shadeLabelId = useId();
  const opacityId = useId();
  const customId = useId();
  const options = field.options.map((option) => option.value);
  const ref = readRef(value, options);
  const base = ref === undefined && options.includes(THEMES) ? THEMES : baseKey(ref, options);
  const hex = ref !== undefined && "hex" in ref.base ? ref.base.hex : undefined;
  const role = ref !== undefined && "role" in ref.base ? ref.base.role : undefined;
  const own = ref !== undefined && "own" in ref.base ? ref.base.own : undefined;

  /** One choice: the new colour, stored, and the end of the change. */
  const choose = (next: ColorRef) => {
    onChange(storedRef(next, options));
    onCommit();
  };
  const withOpacity = (next: ColorRef): ColorRef =>
    ref?.opacity === undefined ? next : { ...next, opacity: ref.opacity };

  const swatches: SwatchOption[] = field.options.map((option) => {
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
  // The person's own colours (TC-1b, #1218), under a heading of their own, by their names in the
  // theme; one no longer in it shows as the field has it, to choose another.
  const ownColors = theme.ownColors ?? [];
  const ownColour = ownColors.find((each) => each.id === own);
  const owns: SwatchOption[] = ownColors.map((each) => ({
    value: `${OWN_COLOR_PREFIX}${each.id}`,
    label: each.name,
    colour: oklchCss(each.color),
  }));
  if (own !== undefined && ownColour === undefined) {
    owns.push({ value: `${OWN_COLOR_PREFIX}${own}`, label: t("colour.ownGone") });
  }
  const [firstOwn, ...otherOwns] = owns;
  if (firstOwn !== undefined) {
    swatches.push({ ...firstOwn, heading: t("colour.yourColours") }, ...otherOwns);
  }
  // What a shade is of: a theme colour that has shades, or one of the person's own colours.
  const shaded: ColorRef["base"] | undefined =
    role !== undefined && isShaded(role)
      ? { role }
      : own !== undefined && ownColour !== undefined
        ? { own }
        : undefined;

  // On what the text is drawn on, in that surface's colours (#670).
  const surface = surfaceOfField?.() ?? { palette: "colors", background: theme.colors["base-100"] };
  const shown =
    ref === undefined ? undefined : resolveColorRef(theme, formatColorRef(ref), surface.palette);
  // Text on a gradient, on the end where it's hardest to read (CT-13); its own rows, a background
  // or a border on it, aren't text.
  const onGradient =
    surface.gradient !== undefined && name !== undefined && TEXT_COLOUR_FIELDS.has(name);
  const ratio =
    shown === undefined || surface.overPicture
      ? undefined
      : onGradient
        ? contrastOn(surface, shown.color, shown.opacity)
        : contrastRatio(shown.color, surface.background, shown.opacity);
  const graphic = isGraphic?.() ?? false;
  const needed = graphic ? AA_LARGE : contrastNeeded(theme, textStyles?.() ?? []);
  const warning = (() => {
    if (ratio === undefined || ratio >= needed) return undefined;
    const values = { ratio: shownRatio(ratio), needed };
    if (graphic) return t("field.color.lowContrastGraphic", values);
    if (!onGradient) return t("field.color.lowContrast", values);
    // A theme text colour that reads on both ends, if one does.
    const suggested = readableTextColour(theme, surface, needed);
    return suggested === undefined
      ? t("field.color.lowContrastGradient", values)
      : t("field.color.lowContrastGradientSuggested", {
          ...values,
          colour: colourRefName(suggested),
        });
  })();

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
          if (next === THEMES) {
            onChange(THEMES);
            onCommit();
            return;
          }
          if (next === CUSTOM) {
            // A colour of its own starts from the one it shows now, to adjust from there.
            const start = hex ?? hexOf(shown?.color ?? theme.colors["base-content"]);
            choose(withOpacity({ base: { hex: start } }));
            return;
          }
          if (next.startsWith(OWN_COLOR_PREFIX)) {
            // At its own colour, the opacity kept, as a theme colour's is.
            choose(withOpacity({ base: { own: next.slice(OWN_COLOR_PREFIX.length) } }));
            return;
          }
          const nextRole = roleOfOption(next);
          if (nextRole !== undefined) choose(withOpacity({ base: { role: nextRole } }));
        }}
        warning={warning}
      />
      {hex !== undefined && advanced ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={customId} className="text-xs text-muted-foreground">
            {t("colour.customHex")}
          </label>
          {/* One step, once the picker closes on another colour (5.26). */}
          <ColourPicker
            id={customId}
            className="w-16"
            value={hex}
            onChoose={(next) => {
              onChange(storedRef(withOpacity({ base: { hex: next } }), options));
              onCommit();
            }}
          />
          <p className="m-0 text-xs text-muted-foreground">{t("colour.offTheme")}</p>
        </div>
      ) : null}
      {shaded === undefined ? null : (
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
                base: shaded,
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
                tooltip={t("colour.shadeStep", { step })}
                className="size-5 min-w-0 rounded-sm p-0 data-[state=on]:ring-2 data-[state=on]:ring-ring"
              >
                <span
                  aria-hidden
                  className="block size-full rounded-sm bg-(--swatch)"
                  style={swatchStyle(
                    oklchCss(
                      resolveColorRef(theme, formatColorRef({ base: shaded, shade: step }))
                        ?.color ?? theme.colors["base-content"],
                    ),
                  )}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
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
 * The Edit panel's renderer for colour fields (R11): {@link ColourField}, in Advanced mode while
 * `preferences` say so. Made once, it follows the editor level (R9).
 */
export function colourFieldRenderer({
  preferences,
  ...context
}: Omit<ColourFieldContext, "advanced"> & {
  readonly preferences: ReadonlyStore<EditorPreferences>;
}): FieldRenderer<"color"> {
  return function SessionColourField(props: FieldRendererProps<"color">) {
    const advanced = usePreferences(
      preferences,
      (state) => state.preferences.editorLevel === "advanced",
    );
    return <ColourField {...props} {...context} advanced={advanced} />;
  };
}
