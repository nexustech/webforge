import { isMessageKey, t } from "@webforge/i18n";
import type { Breakpoint, TextStyle, ThemeTokens } from "@webforge/model";
import { isOverridden, valueAt } from "./responsive-value.js";

/**
 * Where an Appearance field's value comes from, in words (3.12, CT-3), and what shows it: a Theme
 * tab field (`token.radius.field`, `textSize.h2`) or a kind's look in Theme Studio (`look:Button`).
 */
export type Provenance = { readonly text: string; readonly reveal?: string };

/** What {@link provenanceOf} reads about one field of the selected element. */
export type ProvenanceInput = {
  /** The field's name (`lookCorners`) and label ("Corners"). */
  readonly name: string;
  readonly label: string;
  /** The element's own value, set once or per device; undefined where it sets none. */
  readonly own: unknown;
  /** Its kind's look in the theme for the field, if the look sets it. */
  readonly look: unknown;
  /** The component's default for the field. */
  readonly initial: unknown;
  readonly responsive: boolean;
  /** The device shown. */
  readonly breakpoint: Breakpoint;
  /** The element's kind and its name ("Button"). */
  readonly type: string;
  readonly item: string;
  /** The theme's corner token its kind's own corners come from (`ComponentDef.themeCorners`). */
  readonly corners?: "box" | "field" | undefined;
  /** The element's own CSS classes (Advanced). */
  readonly classes: string;
  /** The text style its text is set in, where it has one: what *Theme's* text size is. */
  readonly textStyle?: TextStyle | undefined;
  readonly theme: ThemeTokens;
};

/** The colour fields, which may hold a custom colour (Advanced, ADR 0009). */
const COLOURS = new Set(["lookColor", "lookBackground", "lookBorderColor"]);

/** A custom colour, as ADR 0009 writes it: `[#1f6feb]`, with or without an opacity. */
const CUSTOM_COLOUR = /^\[#[0-9a-f]{6}\]/i;

/** Text utilities that align it, and that size it (Tailwind's scale, the theme's styles, a length). */
const TEXT_ALIGN = /^text-(left|center|right|justify|start|end)$/;
const TEXT_SIZE = /^text-(xs|sm|base|lg|\d?xl|h[1-6]|body|small|\[\d[\w.%]*\])$/;
/** Border utilities that set its width or style rather than its colour. */
const BORDER_WIDTH =
  /^border(-[xytrbl])?(-\d+|-\[\d[\w.]*\])?$|^border-(solid|dashed|dotted|double|none)$/;
/** Font utilities that set its weight rather than its family. */
const FONT_WEIGHT =
  /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/;

/**
 * Whether a utility class sets what each field sets (product/11, 3.12 note 7), telling text
 * alignment, size and colour apart, and a border's width from its colour (#567).
 */
const CLASS_FOR: Readonly<Record<string, (utility: string) => boolean>> = {
  lookCorners: (each) => each === "rounded" || each.startsWith("rounded-"),
  lookShadow: (each) => each === "shadow" || each.startsWith("shadow-"),
  lookBorder: (each) => BORDER_WIDTH.test(each),
  lookBorderColor: (each) => each.startsWith("border-") && !BORDER_WIDTH.test(each),
  lookOpacity: (each) => each.startsWith("opacity-"),
  lookAlign: (each) => TEXT_ALIGN.test(each),
  lookSize: (each) => TEXT_SIZE.test(each),
  lookColor: (each) => each.startsWith("text-") && !TEXT_ALIGN.test(each) && !TEXT_SIZE.test(each),
  lookBackground: (each) => each.startsWith("bg-"),
  lookWeight: (each) => FONT_WEIGHT.test(each),
};

/** Whether `classes` include a utility for field `name`, whatever its variant (`md:`) or `!`. */
function hasClassFor(name: string, classes: string): boolean {
  const matches = CLASS_FOR[name];
  if (matches === undefined) return false;
  return classes
    .split(/\s+/)
    .map((each) => each.replace(/^.*:/, "").replace(/^!|!$/g, ""))
    .some(matches);
}

/** The theme token one value of the field decides by (3.12 note 7), and its value's words. */
function tokenOf(
  input: ProvenanceInput,
): { readonly field: string; readonly value: string } | undefined {
  const { name, corners, theme, textStyle } = input;
  const words = (key: string, value: string) => {
    const word = `theme.token.${key}.${value}`;
    return { field: `token.${key}`, value: isMessageKey(word) ? t(word) : value };
  };
  switch (name) {
    case "lookCorners":
      return corners === undefined ? undefined : words(`radius.${corners}`, theme.radius[corners]);
    case "lookShadow":
      return words("shadow", theme.shadow);
    case "lookBorder":
      return words("border", theme.border);
    case "lookSize":
      return textStyle === undefined
        ? undefined
        : { field: `textSize.${textStyle}`, value: t(`theme.textStyle.${textStyle}`) };
    default:
      return undefined;
  }
}

/** The values that mean the theme's own: what the Appearance group's *Theme's* choices store. */
const THEMES = new Set(["default", "theme"]);

/** Whether `value` is the theme's own: *Theme's* in the control. */
const isTheme = (value: unknown) => typeof value === "string" && THEMES.has(value);

/** The words for the theme's token behind field `input.name`, chosen here or left to the theme. */
function themeToken(input: ProvenanceInput, chosen: boolean): Provenance | undefined {
  const token = tokenOf(input);
  if (token === undefined) return undefined;
  const words = { token: input.label, value: token.value };
  return {
    text: chosen
      ? t("editPanel.source.themeTokenChosen", words)
      : t("editPanel.source.themeToken", words),
    reveal: token.field,
  };
}

/**
 * Where field `input.name`'s value comes from on the device shown (3.12, CT-3), in this order: the
 * element's own value for that device (*Set on Mobile*); its own (*Set here*, *Custom colour
 * (Advanced)* for a colour off the theme, or the theme's token where it chose the theme's); a CSS
 * class of its own for the property (*Class (Advanced)*); its kind's look (*Theme's look for
 * Buttons*); else the theme's token where one decides it (*Theme's (Corners: Medium)*). Nothing
 * where the words would only repeat the control's *Theme's*, or where its default isn't the
 * theme's (an overlay's), which says nothing about the theme (#567).
 */
export function provenanceOf(input: ProvenanceInput): Provenance | undefined {
  const { name, own, look, responsive, breakpoint } = input;
  if (own !== undefined) {
    if (responsive && breakpoint !== "desktop" && isOverridden(own, breakpoint)) {
      return { text: t("editPanel.source.device", { device: t(`device.${breakpoint}`) }) };
    }
    const value = responsive ? valueAt(own, breakpoint) : own;
    if (COLOURS.has(name) && typeof value === "string" && CUSTOM_COLOUR.test(value)) {
      return { text: t("editPanel.source.custom") };
    }
    const chosen = isTheme(value) ? themeToken(input, true) : undefined;
    return chosen ?? { text: t("editPanel.source.here") };
  }
  if (hasClassFor(name, input.classes)) return { text: t("editPanel.source.class") };
  if (look !== undefined) {
    return { text: t("editPanel.source.look", { item: input.item }), reveal: `look:${input.type}` };
  }
  return isTheme(valueAt(input.initial, breakpoint)) ? themeToken(input, false) : undefined;
}
