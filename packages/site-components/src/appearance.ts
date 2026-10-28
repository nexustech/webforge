import { t } from "@webforge/i18n";
import {
  type Breakpoint,
  isResponsiveValue,
  type Responsive,
  resolveResponsive,
} from "@webforge/model";
import { colorClass, onAnyDevice } from "./library.js";
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
/** A gradient's directions (CT-4): down, across, and the two diagonals. */
const GRADIENT_DIRECTIONS = [
  "default",
  "toBottom",
  "toRight",
  "toBottomRight",
  "toTopRight",
] as const;
const BORDER_STYLES = ["default", "solid", "dashed", "dotted"] as const;
/** Spacing tokens (C4): an element's padding (CT-5); its margin is its own `margin` field. */
const SPACINGS = ["default", "none", "s", "m", "l", "xl"] as const;

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

/** The Text controls' names: a section without a title of its own has none (2.22b). */
export const APPEARANCE_TEXT_FIELD_NAMES = [
  "lookSize",
  "lookWeight",
  "lookItalic",
  "lookUnderline",
  "lookCase",
  "lookAlign",
] as const satisfies readonly (keyof typeof APPEARANCE_FIELDS)[];

/** The names of {@link APPEARANCE_FIELDS}, which a component can't give a field of its own. */
export const APPEARANCE_FIELD_NAMES = Object.keys(
  APPEARANCE_FIELDS,
) as readonly (keyof typeof APPEARANCE_FIELDS)[];

/** The group without its Text controls: a section without a title of its own (2.22b). */
export const APPEARANCE_FIELDS_WITHOUT_TEXT = Object.fromEntries(
  Object.entries(APPEARANCE_FIELDS).filter(
    ([name]) => !(APPEARANCE_TEXT_FIELD_NAMES as readonly string[]).includes(name),
  ),
) as Omit<typeof APPEARANCE_FIELDS, (typeof APPEARANCE_TEXT_FIELD_NAMES)[number]>;

/**
 * The groups of *Style this ‹component›…* beyond the Appearance basics (3.13b, CT-2), in the order
 * the dialog shows them. The Style tab leaves their fields out.
 */
export const STYLE_GROUPS = {
  background: { id: "styleBackground", label: t("styleGroup.background") },
  border: { id: "styleBorder", label: t("styleGroup.border") },
  corners: { id: "styleCorners", label: t("styleGroup.corners") },
  shadow: { id: "styleShadow", label: t("styleGroup.shadow") },
  title: { id: "styleTitle", label: t("styleGroup.title") },
  spacing: { id: "styleSpacing", label: t("styleGroup.spacing") },
  hover: { id: "styleHover", label: t("styleGroup.hover") },
} as const;

/** One of {@link STYLE_GROUPS}. */
type StyleGroup = (typeof STYLE_GROUPS)[keyof typeof STYLE_GROUPS];

/** A deeper control's place: the dialog's Style group only, in its group, per device. */
const inDialog = (group: StyleGroup) =>
  ({ group: "style", optionGroup: group, responsive: true, inDialog: true }) as const;

/** A select in `group` of `options`, already named. */
const select = (
  label: string,
  group: StyleGroup,
  options: readonly { readonly label: string; readonly value: string }[],
) => ({ kind: "select", label, ...inDialog(group), options }) as const;

/** The border widths' and corners' options, as the basics name them. */
const BORDER_OPTIONS = BORDERS.map((value) => ({ label: t(`field.look.border.${value}`), value }));
const CORNER_OPTIONS = CORNERS.map((value) => ({ label: t(`field.look.corners.${value}`), value }));
const SPACING_OPTIONS = SPACINGS.map((value) => ({
  label: value === "default" ? t("field.look.spacing.default") : t(`field.spacing.${value}`),
  value,
}));

/**
 * The dialog's deeper controls on every section and element (3.13b): a gradient background (CT-4),
 * each side's border and each corner, an inner shadow, and a colour when hovered. Theme tokens only.
 */
export const DIALOG_FIELDS = {
  lookGradientDirection: select(
    t("field.look.gradient"),
    STYLE_GROUPS.background,
    GRADIENT_DIRECTIONS.map((value) => ({ label: t(`field.look.gradient.${value}`), value })),
  ),
  lookGradientFrom: {
    kind: "color",
    label: t("field.look.gradientFrom"),
    ...inDialog(STYLE_GROUPS.background),
    options: colourOptions(BACKGROUNDS),
  },
  lookGradientTo: {
    kind: "color",
    label: t("field.look.gradientTo"),
    ...inDialog(STYLE_GROUPS.background),
    options: colourOptions(BACKGROUNDS),
  },
  lookBorderTop: select(t("field.look.borderTop"), STYLE_GROUPS.border, BORDER_OPTIONS),
  lookBorderRight: select(t("field.look.borderRight"), STYLE_GROUPS.border, BORDER_OPTIONS),
  lookBorderBottom: select(t("field.look.borderBottom"), STYLE_GROUPS.border, BORDER_OPTIONS),
  lookBorderLeft: select(t("field.look.borderLeft"), STYLE_GROUPS.border, BORDER_OPTIONS),
  lookBorderStyle: select(
    t("field.look.borderStyle"),
    STYLE_GROUPS.border,
    BORDER_STYLES.map((value) => ({ label: t(`field.look.borderStyle.${value}`), value })),
  ),
  lookCornerTopLeft: select(t("field.look.cornerTopLeft"), STYLE_GROUPS.corners, CORNER_OPTIONS),
  lookCornerTopRight: select(t("field.look.cornerTopRight"), STYLE_GROUPS.corners, CORNER_OPTIONS),
  lookCornerBottomRight: select(
    t("field.look.cornerBottomRight"),
    STYLE_GROUPS.corners,
    CORNER_OPTIONS,
  ),
  lookCornerBottomLeft: select(
    t("field.look.cornerBottomLeft"),
    STYLE_GROUPS.corners,
    CORNER_OPTIONS,
  ),
  lookShadowInner: {
    kind: "toggle",
    label: t("field.look.shadowInner"),
    ...inDialog(STYLE_GROUPS.shadow),
  },
  lookHoverColor: {
    kind: "color",
    label: t("field.look.hoverColor"),
    ...inDialog(STYLE_GROUPS.hover),
    options: colourOptions(BACKGROUNDS),
  },
} as const satisfies Readonly<Record<string, FieldDef>>;

/**
 * An element's own spacing in the dialog (CT-5): its padding. The space above and below it is its
 * `margin` field (1.32), which the dialog's Spacing group shows beside it.
 */
export const DIALOG_ELEMENT_FIELDS = {
  lookPadding: select(t("field.look.padding"), STYLE_GROUPS.spacing, SPACING_OPTIONS),
} as const satisfies Readonly<Record<string, FieldDef>>;

/**
 * A titled section's Title group in the dialog: its title's colour (its size, weight, case and
 * alignment are the Appearance basics'), and its subtitle's, where it draws one.
 */
export const DIALOG_TITLE_FIELDS = {
  lookTitleColor: {
    kind: "color",
    label: t("field.look.titleColor"),
    ...inDialog(STYLE_GROUPS.title),
    options: colourOptions(TEXT_COLOURS),
  },
  lookSubtitleSize: select(
    t("field.look.subtitleSize"),
    STYLE_GROUPS.title,
    SIZES.map((value) => ({ label: t(`field.look.size.${value}`), value })),
  ),
  lookSubtitleWeight: select(
    t("field.look.subtitleWeight"),
    STYLE_GROUPS.title,
    WEIGHTS.map((value) => ({ label: t(`field.look.weight.${value}`), value })),
  ),
  lookSubtitleCase: select(
    t("field.look.subtitleCase"),
    STYLE_GROUPS.title,
    CASES.map((value) => ({ label: t(`field.look.case.${value}`), value })),
  ),
  lookSubtitleColor: {
    kind: "color",
    label: t("field.look.subtitleColor"),
    ...inDialog(STYLE_GROUPS.title),
    options: colourOptions(TEXT_COLOURS),
  },
  lookSubtitleAlign: select(
    t("field.look.subtitleAlign"),
    STYLE_GROUPS.title,
    ALIGNMENTS.map((value) => ({ label: t(`field.look.align.${value}`), value })),
  ),
} as const satisfies Readonly<Record<string, FieldDef>>;

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

/** A gradient's direction (CT-4): Tailwind's linear gradients, between the `from` and `to` stops. */
const GRADIENT_CLASSES: Readonly<Record<(typeof GRADIENT_DIRECTIONS)[number], string>> = {
  default: "",
  toBottom: "bg-linear-to-b!",
  toRight: "bg-linear-to-r!",
  toBottomRight: "bg-linear-to-br!",
  toTopRight: "bg-linear-to-tr!",
};
/** One side's border width; its line is the group's style, solid unless set. */
const sideBorderClasses = (side: "t" | "r" | "b" | "l") =>
  ({
    default: "",
    none: `border-${side}-0!`,
    thin: `border-${side}!`,
    thick: `border-${side}-2!`,
  }) as const satisfies Readonly<Record<(typeof BORDERS)[number], string>>;
const BORDER_STYLE_CLASSES: Readonly<Record<(typeof BORDER_STYLES)[number], string>> = {
  default: "",
  solid: "border-solid!",
  dashed: "border-dashed!",
  dotted: "border-dotted!",
};
/** One corner's radius, from the theme's radius scale as the corners' are. */
const cornerClasses = (corner: "tl" | "tr" | "br" | "bl") =>
  ({
    default: "",
    none: `rounded-${corner}-none!`,
    small: `rounded-${corner}-selector!`,
    medium: `rounded-${corner}-field!`,
    large: `rounded-${corner}-box!`,
    full: `rounded-${corner}-full!`,
  }) as const satisfies Readonly<Record<(typeof CORNERS)[number], string>>;
/** An inner shadow's strength: Tailwind's inset shadows, a step under the outer ones. */
const INNER_SHADOW_CLASSES: Readonly<Record<(typeof SHADOWS)[number], string>> = {
  default: "",
  none: "inset-shadow-none!",
  small: "inset-shadow-2xs!",
  medium: "inset-shadow-xs!",
  large: "inset-shadow-sm!",
};
/** A spacing token's classes, `‹prefix›-‹units›!`, in Tailwind spacing `units` per token (C4). */
const spacingClasses = (
  prefix: string,
  units: Readonly<Record<Exclude<(typeof SPACINGS)[number], "default">, number>>,
): Readonly<Record<(typeof SPACINGS)[number], string>> => ({
  default: "",
  ...(Object.fromEntries(
    Object.entries(units).map(([token, size]) => [token, `${prefix}-${size}!`]),
  ) as Record<Exclude<(typeof SPACINGS)[number], "default">, string>),
});
/** An element's padding (CT-5): smaller steps than a section's. */
const PADDING_CLASSES = spacingClasses("p", { none: 0, s: 2, m: 4, l: 6, xl: 8 });

/** The class of one choice in `table`, or none for a value it doesn't have. */
const pick =
  <K extends string>(table: Readonly<Record<K, string>>) =>
  (value: unknown): string =>
    typeof value === "string" && Object.hasOwn(table, value) ? table[value as K] : "";

/** A toggle's class when on. */
const when = (on: string) => (value: unknown) => (value === true ? on : "");

/** A theme colour's class, marked to win: `text-primary-300!`; `hover:` when hovered. */
const colourOf =
  (prefix: "text" | "bg" | "border" | "from" | "to", variant = "") =>
  (value: unknown) => {
    const name = colorClass(prefix, value);
    return name === "" ? "" : `${variant}${name}!`;
  };

/** The devices, smallest first, and the variant for each run of them that share a value. */
export const DEVICES: readonly Breakpoint[] = ["mobile", "tablet", "desktop"];
const DEVICE_RANGE: Readonly<Record<string, string>> = {
  mobile: "max-md:",
  tablet: "md:max-lg:",
  desktop: "lg:",
  "mobile tablet": "max-lg:",
  "tablet desktop": "md:",
  "mobile tablet desktop": "",
};

/**
 * The classes of a value that may be set per device, by `one`: each device's only across its own
 * widths (`max-md:` Mobile, `md:max-lg:` Tablet, `lg:` Desktop; joined where neighbours agree), so
 * *Theme's* on a device draws nothing there, whatever another device has. (`responsiveClasses` is
 * mobile first: a value drawing no class couldn't undo a smaller device's.)
 */
export function perDevice(value: unknown, one: (value: unknown) => string): string {
  if (!isResponsiveValue(value as Responsive<unknown>)) return one(value);
  const runs: { devices: Breakpoint[]; classes: string }[] = [];
  for (const device of DEVICES) {
    const classes = one(resolveResponsive(value as Responsive<unknown>, device));
    const last = runs.at(-1);
    if (last !== undefined && last.classes === classes) last.devices.push(device);
    else runs.push({ devices: [device], classes });
  }
  return runs
    .flatMap(({ devices, classes }) => {
      const range = DEVICE_RANGE[devices.join(" ")] ?? "";
      return classes
        .split(" ")
        .filter((name) => name !== "")
        .map((name) => `${range}${name}`);
    })
    .join(" ");
}

/** The Appearance values among a component's, as its render or the document has them. */
type AppearanceValues = { readonly [field: string]: unknown };

/** A field's classes from its stored value, set once or per device, and the item's other values. */
type FieldClasses = (value: unknown, values: AppearanceValues) => string;

/** `one`'s classes for a value set once or per device ({@link perDevice}). */
const onDevices =
  (one: (value: unknown) => string): FieldClasses =>
  (value) =>
    perDevice(value, one);

/** Whether `value`, on any device, is a theme colour of the item's own (not *Theme's*). */
const anyColour = (value: unknown) => onAnyDevice(value, (one) => colorClass("bg", one) !== "");
/** Whether a select of `table`'s choices draws something on any device. */
const anyChoice = (table: Readonly<Record<string, string>>) => (value: unknown) =>
  onAnyDevice(value, (one) => pick(table)(one) !== "");

/** A gradient draws only with its direction and both its ends (CT-4). */
const hasGradient = (values: AppearanceValues) =>
  anyChoice(GRADIENT_CLASSES)(values.lookGradientDirection) &&
  anyColour(values.lookGradientFrom) &&
  anyColour(values.lookGradientTo);
const gradientPart =
  (one: (value: unknown) => string): FieldClasses =>
  (value, values) =>
    hasGradient(values) ? perDevice(value, one) : "";

/** The item's border style, when the dialog sets one: then a width draws no solid line of its own. */
const styled = (values: AppearanceValues) =>
  anyChoice(BORDER_STYLE_CLASSES)(values.lookBorderStyle);
const SIDES = ["lookBorderTop", "lookBorderRight", "lookBorderBottom", "lookBorderLeft"] as const;

/** The width all round (the basics'), its solid line left to the dialog's style when it has one. */
const borderAllRound: FieldClasses = (value, values) =>
  perDevice(value, (one) => {
    const classes = pick(BORDER_CLASSES)(one);
    return styled(values) ? classes.replace(" border-solid!", "") : classes;
  });

/** A side with a line: Thin or Thick, not None. */
const drawnSide = (value: unknown) =>
  onAnyDevice(value, (one) => one === "thin" || one === "thick");

/** The line's style: the dialog's, or solid for a side drawn without one or a width all round. */
const borderLine: FieldClasses = (value, values) => {
  if (styled(values)) return perDevice(value, pick(BORDER_STYLE_CLASSES));
  const sides = SIDES.some((side) => drawnSide(values[side]));
  return sides && !anyChoice(BORDER_CLASSES)(values.lookBorder) ? "border-solid!" : "";
};

/**
 * The shadow, outer or (with the dialog's toggle) inner, at its strength. An inner shadow replaces
 * the outer one; at the theme's strength it is the medium one, so the toggle always draws one.
 */
const shadow: FieldClasses = (value, values) =>
  values.lookShadowInner === true
    ? perDevice(value, (one) => pick(INNER_SHADOW_CLASSES)(one) || INNER_SHADOW_CLASSES.medium)
    : perDevice(value, pick(SHADOW_CLASSES));

/**
 * The Text controls' classes, by field, in the order they're written (2.22): for an element its
 * own, for a section its title's, with the title's colour from the dialog (3.13b).
 */
const TEXT_CLASSES = {
  lookSize: onDevices(pick(SIZE_CLASSES)),
  lookWeight: onDevices(pick(WEIGHT_CLASSES)),
  lookItalic: onDevices(when("italic!")),
  lookUnderline: onDevices(when("underline!")),
  lookCase: onDevices(pick(CASE_CLASSES)),
  lookAlign: onDevices(pick(ALIGN_CLASSES)),
  lookTitleColor: onDevices(colourOf("text")),
} as const satisfies Readonly<Record<string, FieldClasses>>;

/** A section's subtitle's classes, by field (3.13b): its lead, under the title. */
const SUBTITLE_CLASSES = {
  lookSubtitleSize: onDevices(pick(SIZE_CLASSES)),
  lookSubtitleWeight: onDevices(pick(WEIGHT_CLASSES)),
  lookSubtitleCase: onDevices(pick(CASE_CLASSES)),
  lookSubtitleColor: onDevices(colourOf("text")),
  lookSubtitleAlign: onDevices(pick(ALIGN_CLASSES)),
} as const satisfies Readonly<Record<string, FieldClasses>>;

/**
 * The other controls' classes, by field, in the order they're written: the basics' (2.22), then
 * the dialog's (3.13b) after the basic each refines.
 */
const BOX_CLASSES = {
  lookColor: onDevices(colourOf("text")),
  lookBackground: onDevices(colourOf("bg")),
  lookGradientDirection: gradientPart(pick(GRADIENT_CLASSES)),
  lookGradientFrom: gradientPart(colourOf("from")),
  lookGradientTo: gradientPart(colourOf("to")),
  lookCorners: onDevices(pick(CORNER_CLASSES)),
  lookCornerTopLeft: onDevices(pick(cornerClasses("tl"))),
  lookCornerTopRight: onDevices(pick(cornerClasses("tr"))),
  lookCornerBottomRight: onDevices(pick(cornerClasses("br"))),
  lookCornerBottomLeft: onDevices(pick(cornerClasses("bl"))),
  lookBorder: borderAllRound,
  lookBorderTop: onDevices(pick(sideBorderClasses("t"))),
  lookBorderRight: onDevices(pick(sideBorderClasses("r"))),
  lookBorderBottom: onDevices(pick(sideBorderClasses("b"))),
  lookBorderLeft: onDevices(pick(sideBorderClasses("l"))),
  lookBorderStyle: borderLine,
  lookBorderColor: onDevices(colourOf("border")),
  lookShadow: shadow,
  lookOpacity: onDevices(pick(OPACITY_CLASSES)),
  lookPadding: onDevices(pick(PADDING_CLASSES)),
  lookHoverColor: (value, values) =>
    perDevice(value, (one) => {
      const colour = colourOf("bg", "hover:")(one);
      // A gradient is a background image, which a colour alone would stay under.
      return colour !== "" && hasGradient(values) ? `${colour} hover:bg-none!` : colour;
    }),
} as const satisfies Readonly<Record<string, FieldClasses>>;

/** Each field's classes in `table` for `values`, those that draw something, in the table's order. */
const groupsOf = (table: Readonly<Record<string, FieldClasses>>, values: AppearanceValues) =>
  Object.entries(table)
    .map(([field, classes]) => ({ field, classes: classes(values[field], values) }))
    .filter((group) => group.classes !== "");

/** The classes of `table` for `values`, joined. */
const classesOf = (table: Readonly<Record<string, FieldClasses>>, values: AppearanceValues) =>
  groupsOf(table, values)
    .map((group) => group.classes)
    .join(" ");

/** The Text controls' classes (2.22): for an element its own, for a section its title's. */
export function appearanceTextClasses(values: AppearanceValues): string {
  return classesOf(TEXT_CLASSES, values);
}

/**
 * The other controls' classes (2.22): colours, corners, border, shadow and opacity; and the
 * dialog's gradient, sides, corners, inner shadow, spacing and colour when hovered (3.13b).
 */
export function appearanceBoxClasses(values: AppearanceValues): string {
  return classesOf(BOX_CLASSES, values);
}

/** A section's subtitle's classes (3.13b): its lead's, under its title. */
export function appearanceSubtitleClasses(values: AppearanceValues): string {
  return classesOf(SUBTITLE_CLASSES, values);
}

/**
 * Each Appearance field that draws something for `values`, with its classes (3.14's CSS tab, which
 * shows an item's classes by the control that set them): the Text controls' first (a section's
 * title's), then a section's subtitle's, then the others, as {@link appearanceTextClasses},
 * {@link appearanceSubtitleClasses} and {@link appearanceBoxClasses} write them.
 */
export function appearanceClassGroups(
  values: AppearanceValues,
): readonly { readonly field: string; readonly classes: string }[] {
  return [
    ...groupsOf(TEXT_CLASSES, values),
    ...groupsOf(SUBTITLE_CLASSES, values),
    ...groupsOf(BOX_CLASSES, values),
  ];
}

/** A colour of the group's own: a theme colour, not *Theme's*. */
const ownColour = (value: unknown) => colorClass("text", value) !== "";

/** Whether the group gives an item a colour or background of its own on `device`. */
const ownColourOn = (values: AppearanceValues, device: Breakpoint) =>
  [values.lookColor, values.lookBackground].some((value) =>
    ownColour(
      isResponsiveValue(value as Responsive<unknown>)
        ? resolveResponsive(value as Responsive<unknown>, device)
        : value,
    ),
  );

/**
 * `classes` on the devices where the group gives an item a colour or background of its own, and
 * on no other, with a space before them to append to others (2.22b). A Button with one darkens when
 * hovered unless its hover row says otherwise, as its own colours would have, which the group's
 * (marked to win) now outrank; device by device, as the colour's own classes are. `classes` may
 * differ by device too (its hover row is set per device, 2.28).
 */
export function whereOwnColour(
  values: AppearanceValues,
  classes: string | ((device: Breakpoint) => string),
): string {
  // Most items have neither, on any device.
  if (!onAnyDevice(values.lookColor, ownColour) && !onAnyDevice(values.lookBackground, ownColour)) {
    return "";
  }
  const on = typeof classes === "string" ? () => classes : classes;
  const own = Object.fromEntries(
    DEVICES.map((device) => [device, ownColourOn(values, device) ? on(device).trim() : ""]),
  );
  const drawn = perDevice({ $responsive: own }, (value) =>
    typeof value === "string" ? value : "",
  );
  return drawn === "" ? "" : ` ${drawn}`;
}
