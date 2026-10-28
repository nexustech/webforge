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
  /** The element's kind, its name ("Button") and whether it is a section. */
  readonly type: string;
  readonly item: string;
  readonly section: boolean;
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

/** The utility classes that set what each field sets, by their start (product/11, 3.12 note 7). */
const CLASS_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  lookCorners: ["rounded"],
  lookShadow: ["shadow"],
  lookBorder: ["border"],
  lookBorderColor: ["border-"],
  lookOpacity: ["opacity-"],
  lookColor: ["text-"],
  lookSize: ["text-"],
  lookAlign: ["text-"],
  lookBackground: ["bg-"],
  lookWeight: ["font-"],
};

/** Whether `classes` include a utility for field `name`, whatever its variant (`md:`) or `!`. */
function hasClassFor(name: string, classes: string): boolean {
  const prefixes = CLASS_PREFIXES[name];
  if (prefixes === undefined) return false;
  return classes
    .split(/\s+/)
    .map((each) => each.replace(/^.*:/, "").replace(/^!|!$/g, ""))
    .some((each) => prefixes.some((prefix) => each === prefix || each.startsWith(prefix)));
}

/** The theme token one value of the field decides by (3.12 note 7), and its value's words. */
function tokenOf(
  input: ProvenanceInput,
): { readonly field: string; readonly value: string } | undefined {
  const { name, type, section, theme, textStyle } = input;
  const words = (key: string, value: string) => {
    const word = `theme.token.${key}.${value}`;
    return { field: `token.${key}`, value: isMessageKey(word) ? t(word) : value };
  };
  switch (name) {
    case "lookCorners":
      if (type === "Button") return words("radius.field", theme.radius.field);
      return section ? words("radius.box", theme.radius.box) : undefined;
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

/**
 * Where field `input.name`'s value comes from on the device shown (3.12, CT-3), in this order: the
 * element's own value for that device (*Set on Mobile*), its own (*Set here*, or *Custom colour
 * (Advanced)* for a colour off the theme); a CSS class of its own for the property (*Class
 * (Advanced)*); its kind's look (*Theme's look for Buttons*); else the theme, naming the token where
 * one decides the value (*Theme's (Corners: Medium)*), plain *Theme's* elsewhere.
 */
export function provenanceOf(input: ProvenanceInput): Provenance {
  const { name, own, look, responsive, breakpoint, label } = input;
  if (own !== undefined) {
    if (responsive && breakpoint !== "desktop" && isOverridden(own, breakpoint)) {
      return { text: t("editPanel.source.device", { device: t(`device.${breakpoint}`) }) };
    }
    const value = responsive ? valueAt(own, breakpoint) : own;
    if (COLOURS.has(name) && typeof value === "string" && CUSTOM_COLOUR.test(value)) {
      return { text: t("editPanel.source.custom") };
    }
    return { text: t("editPanel.source.here") };
  }
  if (hasClassFor(name, input.classes)) return { text: t("editPanel.source.class") };
  if (look !== undefined) {
    return { text: t("editPanel.source.look", { item: input.item }), reveal: `look:${input.type}` };
  }
  const initial = valueAt(input.initial, breakpoint);
  const token = typeof initial === "string" && THEMES.has(initial) ? tokenOf(input) : undefined;
  return token === undefined
    ? { text: t("editPanel.source.theme") }
    : {
        text: t("editPanel.source.themeToken", { token: label, value: token.value }),
        reveal: token.field,
      };
}
