import {
  type FieldRendererProps,
  registerFieldRenderer,
  SwatchField,
  type SwatchOption,
} from "@webforge/editor-ui";
import { type MessageKey, t } from "@webforge/i18n";
import {
  COLOR_ROLES,
  type ColorRole,
  type Oklch,
  type TextStyle,
  type ThemeTokens,
} from "@webforge/model";
import { useSyncExternalStore } from "react";
import type { EditorSession } from "./editor-session.js";

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
 * The least contrast WCAG AA asks of text in `style` (F-DS-2): 3:1 for large text (at least 24 px,
 * or 18.66 px when bold), 4.5:1 for any other, and for text whose style isn't known.
 */
export function contrastNeeded(theme: ThemeTokens, style: TextStyle | undefined): number {
  if (style === undefined) return 4.5;
  const { size, weight } = theme.typeScale[style];
  const px = TEXT_PX[size];
  return px >= 24 || (px >= 18.66 && weight >= 700) ? 3 : 4.5;
}

/**
 * WCAG's contrast ratio of two theme colours, 1–21. The themes package's (2.1) is passed in; until
 * it is, the field shows no contrast warning.
 */
export type ContrastRatio = (a: Oklch, b: Oklch) => number;

/** What the colour field needs besides its field's props. */
export type ColourFieldContext = {
  readonly session: Pick<EditorSession, "history">;
  readonly contrastRatio?: ContrastRatio | undefined;
  /**
   * The text style of the element being edited (a Heading's h2, a Text's body), which sets how much
   * contrast it needs; the stricter 4.5:1 while it isn't known.
   */
  readonly textStyle?: (() => TextStyle | undefined) | undefined;
};

/** A theme colour as CSS, as daisyUI writes them. */
const cssColour = ({ l, c, h }: Oklch) => `oklch(${l * 100}% ${c} ${h})`;

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

/**
 * The theme colour a colour field's value names: the theme's text colour for `default`, else the
 * role of that name. Undefined for a value that names no role.
 */
function roleOf(value: string): ColorRole | undefined {
  if (value === "default") return "base-content";
  return (COLOR_ROLES as readonly string[]).includes(value) ? (value as ColorRole) : undefined;
}

/**
 * The colours a field offers, each in the theme's colour and by its glossary name: the field's own
 * choices, which are theme colours (C4). The theme's custom colours (UX-25) join them once the
 * theme has them (2.1), and shades and opacity once the theme's CSS names them.
 */
function coloursOf(field: FieldRendererProps["field"], theme: ThemeTokens): SwatchOption[] {
  return (field.options ?? []).map((option) => {
    const role = roleOf(option.value);
    if (role === undefined) return option;
    const name = ROLE_NAMES[role];
    return {
      value: option.value,
      label: name === undefined ? option.label : t(name),
      colour: cssColour(theme.colors[role]),
    };
  });
}

/**
 * The Edit panel's colour field (1.37, UX-25): the theme's colours as swatches, as this site shows
 * them, and a warning when the one chosen is hard to read on the page (below what WCAG AA asks of
 * text of its size: {@link contrastNeeded}; sections all have the page's background so far).
 */
export function ColourField({
  id,
  labelId,
  field,
  value,
  onChange,
  onCommit,
  session,
  contrastRatio,
  textStyle,
}: FieldRendererProps & ColourFieldContext) {
  const theme = useSyncExternalStore(
    session.history.document.subscribe,
    () => session.history.document.getState().theme,
  );
  const chosen = typeof value === "string" ? value : undefined;
  const role = chosen === undefined ? undefined : roleOf(chosen);
  const ratio =
    role === undefined || contrastRatio === undefined
      ? undefined
      : contrastRatio(theme.colors[role], theme.colors["base-100"]);
  return (
    <SwatchField
      id={id}
      labelId={labelId}
      options={coloursOf(field, theme)}
      value={chosen}
      onChoose={(next) => {
        onChange(next);
        onCommit();
      }}
      warning={
        ratio === undefined || ratio >= contrastNeeded(theme, textStyle?.())
          ? undefined
          : t("field.color.lowContrast", {
              ratio: ratio.toFixed(1),
              needed: contrastNeeded(theme, textStyle?.()),
            })
      }
    />
  );
}

/**
 * Makes the Edit panel draw colour fields with {@link ColourField}. Returns the function that puts
 * the previous renderer back.
 */
export function registerColourField(context: ColourFieldContext): () => void {
  function SessionColourField(props: FieldRendererProps) {
    return <ColourField {...props} {...context} />;
  }
  return registerFieldRenderer("color", SessionColourField);
}
