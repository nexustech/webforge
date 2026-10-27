import { t } from "@webforge/i18n";
import { isResponsiveValue, type Responsive } from "@webforge/model";
import { colorClass, responsiveClasses } from "./library.js";
import type { FieldDef } from "./schema.js";

/**
 * The Appearance group (2.22, ST-1): the same token controls on every section and element, added
 * by `defineSection` and `defineComponent`, shown first in the Style tab. Every value is a design
 * token from the theme (ST-6), set per device (F-ED-4); `default` leaves the component as it draws
 * itself. Its classes come last and win (`!`), since a person's choice for this one item outranks
 * how the component looks by default.
 */
export const APPEARANCE_GROUP = {
  id: "appearance",
  label: t("editPanel.optionGroup.appearance"),
} as const;

/** The type scale's text styles, smallest first, as the theme sets them (#419). */
const SIZES = ["default", "small", "body", "h6", "h5", "h4", "h3", "h2", "h1"] as const;
const WEIGHTS = ["default", "normal", "medium", "semibold", "bold"] as const;
const CASES = ["default", "normal", "uppercase", "lowercase", "capitalize"] as const;
const ALIGNMENTS = ["default", "left", "centre", "right"] as const;
/**
 * Text colours: the theme's, Text and Brand to Second accent, with shades (ADR 0009's hex in
 * Advanced mode). `theme` leaves the item's own colour: the colour field offers it as *Theme's*.
 */
const TEXT_COLOURS = ["theme", "base-content", "primary", "secondary", "accent"] as const;
/** Backgrounds: the theme's surfaces, then its colours. */
const BACKGROUNDS = [
  "theme",
  "base-100",
  "base-200",
  "base-300",
  "primary",
  "secondary",
  "accent",
  "neutral",
] as const;
/** Corners from the theme's radius scale: its selectors', fields' and boxes' (2.3). */
const CORNERS = ["default", "none", "small", "medium", "large", "full"] as const;
const BORDERS = ["default", "none", "thin", "thick"] as const;
const BORDER_COLOURS = [
  "theme",
  "base-300",
  "base-content",
  "primary",
  "secondary",
  "accent",
] as const;
/** Shadows from the theme's shadow scale, which a theme without shadows sets to none. */
const SHADOWS = ["default", "none", "small", "medium", "large"] as const;
const OPACITIES = ["default", "90", "75", "50", "25"] as const;

/** What every control in the group shares: the Style tab, the group, a value per device. */
const IN_GROUP = { group: "style", optionGroup: APPEARANCE_GROUP, responsive: true } as const;

/** The colours' names, the glossary's (Brand, Accent, Surface, Text…). */
const COLOUR_NAMES = {
  theme: t("field.look.colour.theme"),
  "base-100": t("field.look.colour.base-100"),
  "base-200": t("field.look.colour.base-200"),
  "base-300": t("field.look.colour.base-300"),
  "base-content": t("field.look.colour.base-content"),
  primary: t("field.look.colour.primary"),
  secondary: t("field.look.colour.secondary"),
  accent: t("field.look.colour.accent"),
  neutral: t("field.look.colour.neutral"),
} as const;

/** `values` as a colour field's options, by their names. */
const colourOptions = (values: readonly (keyof typeof COLOUR_NAMES)[]) =>
  values.map((value) => ({ label: COLOUR_NAMES[value], value }));

/** The group's fields, by the names they're stored under: `look…`, clear of any component's own. */
export const APPEARANCE_FIELDS = {
  lookSize: {
    kind: "select",
    label: t("field.look.size"),
    ...IN_GROUP,
    options: SIZES.map((value) => ({ label: t(`field.look.size.${value}`), value })),
  },
  lookWeight: {
    kind: "select",
    label: t("field.look.weight"),
    ...IN_GROUP,
    options: WEIGHTS.map((value) => ({ label: t(`field.look.weight.${value}`), value })),
  },
  lookItalic: { kind: "toggle", label: t("field.look.italic"), ...IN_GROUP },
  lookUnderline: { kind: "toggle", label: t("field.look.underline"), ...IN_GROUP },
  lookCase: {
    kind: "select",
    label: t("field.look.case"),
    ...IN_GROUP,
    options: CASES.map((value) => ({ label: t(`field.look.case.${value}`), value })),
  },
  lookAlign: {
    kind: "select",
    label: t("field.look.align"),
    ...IN_GROUP,
    options: ALIGNMENTS.map((value) => ({ label: t(`field.look.align.${value}`), value })),
  },
  lookColor: {
    kind: "color",
    label: t("field.look.color"),
    ...IN_GROUP,
    options: colourOptions(TEXT_COLOURS),
  },
  lookBackground: {
    kind: "color",
    label: t("field.look.background"),
    ...IN_GROUP,
    options: colourOptions(BACKGROUNDS),
  },
  lookCorners: {
    kind: "select",
    label: t("field.look.corners"),
    ...IN_GROUP,
    options: CORNERS.map((value) => ({ label: t(`field.look.corners.${value}`), value })),
  },
  lookBorder: {
    kind: "select",
    label: t("field.look.border"),
    ...IN_GROUP,
    options: BORDERS.map((value) => ({ label: t(`field.look.border.${value}`), value })),
  },
  lookBorderColor: {
    kind: "color",
    label: t("field.look.borderColor"),
    ...IN_GROUP,
    options: colourOptions(BORDER_COLOURS),
  },
  lookShadow: {
    kind: "select",
    label: t("field.look.shadow"),
    ...IN_GROUP,
    options: SHADOWS.map((value) => ({ label: t(`field.look.shadow.${value}`), value })),
  },
  lookOpacity: {
    kind: "select",
    label: t("field.look.opacity"),
    ...IN_GROUP,
    options: OPACITIES.map((value) => ({ label: t(`field.look.opacity.${value}`), value })),
  },
} as const satisfies Readonly<Record<string, FieldDef>>;

/** The names of {@link APPEARANCE_FIELDS}, which a component can't give a field of its own. */
export const APPEARANCE_FIELD_NAMES = Object.keys(
  APPEARANCE_FIELDS,
) as readonly (keyof typeof APPEARANCE_FIELDS)[];

/** Each choice's classes, written in full; `default` adds none. `!` wins over the component's. */
const SIZE_CLASSES: Readonly<Record<(typeof SIZES)[number], string>> = {
  default: "",
  small: "text-small!",
  body: "text-body!",
  h6: "text-h6!",
  h5: "text-h5!",
  h4: "text-h4!",
  h3: "text-h3!",
  h2: "text-h2!",
  h1: "text-h1!",
};
const WEIGHT_CLASSES: Readonly<Record<(typeof WEIGHTS)[number], string>> = {
  default: "",
  normal: "font-normal!",
  medium: "font-medium!",
  semibold: "font-semibold!",
  bold: "font-bold!",
};
const CASE_CLASSES: Readonly<Record<(typeof CASES)[number], string>> = {
  default: "",
  normal: "normal-case!",
  uppercase: "uppercase!",
  lowercase: "lowercase!",
  capitalize: "capitalize!",
};
const ALIGN_CLASSES: Readonly<Record<(typeof ALIGNMENTS)[number], string>> = {
  default: "",
  left: "text-left!",
  centre: "text-center!",
  right: "text-right!",
};
const CORNER_CLASSES: Readonly<Record<(typeof CORNERS)[number], string>> = {
  default: "",
  none: "rounded-none!",
  small: "rounded-selector!",
  medium: "rounded-field!",
  large: "rounded-box!",
  full: "rounded-full!",
};
const BORDER_CLASSES: Readonly<Record<(typeof BORDERS)[number], string>> = {
  default: "",
  none: "border-0!",
  thin: "border! border-solid!",
  thick: "border-2! border-solid!",
};
const SHADOW_CLASSES: Readonly<Record<(typeof SHADOWS)[number], string>> = {
  default: "",
  none: "shadow-none!",
  small: "shadow-sm!",
  medium: "shadow-md!",
  large: "shadow-lg!",
};
const OPACITY_CLASSES: Readonly<Record<(typeof OPACITIES)[number], string>> = {
  default: "",
  "90": "opacity-90!",
  "75": "opacity-75!",
  "50": "opacity-50!",
  "25": "opacity-25!",
};

/** The class of one choice in `table`, or none for a value it doesn't have. */
const pick =
  <K extends string>(table: Readonly<Record<K, string>>) =>
  (value: unknown): string =>
    typeof value === "string" && Object.hasOwn(table, value) ? table[value as K] : "";

/** A toggle's class when on. */
const when = (on: string) => (value: unknown) => (value === true ? on : "");

/** A theme colour's class, marked to win: `text-primary-300!`. */
const colourOf = (prefix: "text" | "bg" | "border") => (value: unknown) => {
  const name = colorClass(prefix, value);
  return name === "" ? "" : `${name}!`;
};

/** The classes of a value that may be set per device, by `one`. */
function perDevice(value: unknown, one: (value: unknown) => string): string {
  return isResponsiveValue(value as Responsive<unknown>)
    ? responsiveClasses(value as Responsive<unknown>, one)
    : one(value);
}

/** The Appearance values among a component's, as its render or the document has them. */
type AppearanceValues = { readonly [field: string]: unknown };

/** The Text controls' classes (2.22): for an element its own, for a section its title's. */
export function appearanceTextClasses(values: AppearanceValues): string {
  return [
    perDevice(values.lookSize, pick(SIZE_CLASSES)),
    perDevice(values.lookWeight, pick(WEIGHT_CLASSES)),
    perDevice(values.lookItalic, when("italic!")),
    perDevice(values.lookUnderline, when("underline!")),
    perDevice(values.lookCase, pick(CASE_CLASSES)),
    perDevice(values.lookAlign, pick(ALIGN_CLASSES)),
  ]
    .filter((part) => part !== "")
    .join(" ");
}

/** The other controls' classes (2.22): colours, corners, border, shadow and opacity. */
export function appearanceBoxClasses(values: AppearanceValues): string {
  return [
    perDevice(values.lookColor, colourOf("text")),
    perDevice(values.lookBackground, colourOf("bg")),
    perDevice(values.lookCorners, pick(CORNER_CLASSES)),
    perDevice(values.lookBorder, pick(BORDER_CLASSES)),
    perDevice(values.lookBorderColor, colourOf("border")),
    perDevice(values.lookShadow, pick(SHADOW_CLASSES)),
    perDevice(values.lookOpacity, pick(OPACITY_CLASSES)),
  ]
    .filter((part) => part !== "")
    .join(" ");
}
