import { z } from "zod";
import {
  type Breakpoint,
  isResponsiveValue,
  type Responsive,
  resolveResponsive,
} from "./responsive.js";

/**
 * The fields a kind's look holds (3.12, CT-1): the Appearance group's, with a section's overlay over
 * its background image and the hover row's, which share its option group, and *Style this
 * ‹component›…*'s deeper groups (3.13b): the same fields 2.27's *Apply this look* copies. The
 * background image itself is content, so it isn't one.
 */
export const LOOK_FIELDS = [
  // The theme's font for its text (3.22, PF-5): new in format 11.
  "lookFont",
  "lookSize",
  "lookWeight",
  "lookItalic",
  "lookUnderline",
  "lookCase",
  "lookAlign",
  "lookColor",
  "lookBackground",
  "lookCorners",
  "lookBorder",
  "lookBorderColor",
  "lookShadow",
  "lookOpacity",
  "overlay",
  "overlayColor",
  "hover",
  "hoverSpeed",
  "hoverEasing",
  // Style this ‹component›…'s deeper groups (3.13b). Optional, absent meaning as before, so a look
  // holding them needs no new format (ADR 0012).
  "lookGradientDirection",
  "lookGradientFrom",
  "lookGradientTo",
  // How much of a picture a gradient over it covers (CT-14).
  "lookGradientOpacity",
  "lookBorderTop",
  "lookBorderRight",
  "lookBorderBottom",
  "lookBorderLeft",
  "lookBorderStyle",
  "lookCornerTopLeft",
  "lookCornerTopRight",
  "lookCornerBottomRight",
  "lookCornerBottomLeft",
  "lookShadowInner",
  "lookHoverColor",
  "lookPadding",
  "lookTitleColor",
  "lookSubtitleSize",
  "lookSubtitleWeight",
  "lookSubtitleCase",
  "lookSubtitleColor",
  "lookSubtitleAlign",
] as const;

/** A field of a kind's look. */
export type LookField = (typeof LOOK_FIELDS)[number];

/** The look's colour fields: a theme role (with shade and opacity) only, never a custom colour. */
const COLOUR_FIELDS: ReadonlySet<LookField> = new Set([
  "lookColor",
  "lookBackground",
  "lookBorderColor",
  "lookGradientFrom",
  "lookGradientTo",
  "lookHoverColor",
  "lookTitleColor",
  "lookSubtitleColor",
]);

/** One value as an item stores it: a token's name, or a toggle. */
const tokenSchema = z.union([z.string().max(64), z.boolean()]);

/** A value set once, or per device (F-ED-4), as an item stores it. */
const lookValueSchema = z.union([
  tokenSchema,
  z.strictObject({
    $responsive: z.strictObject({
      desktop: tokenSchema,
      tablet: tokenSchema.optional(),
      mobile: tokenSchema.optional(),
    }),
  }),
]);

/**
 * A custom colour as ADR 0009 writes it, `[#1f6feb]` with or without an opacity: read here by its
 * form, as the colour refs' parser needs the theme's roles, which import this module.
 */
export const CUSTOM_COLOUR = /^\[#[0-9a-f]{6}\]/i;

/** Whether `value` names a custom colour, on any device. */
function holdsCustomColour(value: z.infer<typeof lookValueSchema>): boolean {
  const each = typeof value === "object" ? Object.values(value.$responsive) : [value];
  return each.some((one) => typeof one === "string" && CUSTOM_COLOUR.test(one));
}

/**
 * A kind's look (3.12, CT-1): the values its items take for the fields they don't set themselves,
 * as an item stores them. A custom colour belongs to the one item it's set on (ADR 0009), so a look
 * holds the theme's colours only. Each component's own fields read the values as they read an
 * item's: one they don't offer reads as their default.
 */
export const componentLookSchema = z
  .partialRecord(z.enum(LOOK_FIELDS), lookValueSchema)
  .refine(
    (look) =>
      Object.entries(look).every(
        ([field, value]) =>
          value === undefined ||
          !COLOUR_FIELDS.has(field as LookField) ||
          !holdsCustomColour(value),
      ),
    { message: "A look holds the theme's colours only" },
  );

/** A kind's look; see {@link componentLookSchema}. */
export type ComponentLook = z.infer<typeof componentLookSchema>;

/** The theme's looks by kind: a component type, such as `Button` or `CallToAction`. */
export const looksSchema = z.record(
  z.string().regex(/^[A-Z][A-Za-z0-9]{0,63}$/),
  componentLookSchema,
);

/** The theme's looks; see {@link looksSchema}. */
export type Looks = z.infer<typeof looksSchema>;

/** Where an item's value for a field comes from: its own, its kind's look, or its default. */
export type ValueSource = "own" | "look" | "default";

/**
 * The colours a gradient's ends draw with while they have none of their own (CT-10): Brand to
 * Accent. Choosing a direction gives an end without a colour this one, and the contrast check
 * measures text on these (CT-13), so the controls, the drawing and the check agree.
 */
export const GRADIENT_END_DEFAULTS = {
  lookGradientFrom: "primary",
  lookGradientTo: "secondary",
} as const;

/**
 * The fields where *Theme's* (`theme`) is no value of an item's own: a gradient's ends, which no
 * longer offer it (CT-10). An end stored so, from before, takes its kind's look on the devices it
 * has it, as an end never set does, and else draws with its default.
 */
const THEMES_IS_UNSET: ReadonlySet<string> = new Set(["lookGradientFrom", "lookGradientTo"]);

const DEVICES: readonly Breakpoint[] = ["desktop", "tablet", "mobile"];

/** A value on `device`, set once or per device. */
const valueOn = (value: unknown, device: Breakpoint) =>
  resolveResponsive(value as Responsive<unknown>, device);

/**
 * An item's own value of field `name`, with *Theme's* taken from `look` where it isn't one of its
 * own ({@link THEMES_IS_UNSET}): `undefined` for an item that has none.
 */
function ownValue(name: string, own: unknown, look: unknown): unknown {
  if (!THEMES_IS_UNSET.has(name)) return own;
  if (own === "theme") return undefined;
  // Per device, Theme's takes the look's value there: without one, it stays as stored, which
  // draws as unset, so every device keeps a value (the stored form needs Desktop's).
  if (!isResponsiveValue(own as Responsive<unknown>) || look === undefined) return own;
  if (!DEVICES.some((device) => valueOn(own, device) === "theme")) return own;
  const [desktop, tablet, mobile] = DEVICES.map((device) => {
    const one = valueOn(own, device);
    return one === "theme" ? valueOn(look, device) : one;
  });
  return tablet === desktop && mobile === desktop
    ? desktop
    : { $responsive: { desktop, tablet, mobile } };
}

/**
 * `values`, an item's own, over its kind's `look` (3.12, CT-1): each field it doesn't set itself
 * takes the look's value; one it sets, even to the theme's (`default`), keeps it, but for a
 * gradient's end, where *Theme's* is no choice (CT-10). The one rule the canvas, the export, Site
 * Check and AI apps' `fields` all read an item by (#670).
 */
export function valuesWithLook<Values extends Readonly<Record<string, unknown>>>(
  values: Values,
  look: Readonly<Record<string, unknown>> | undefined,
): Values {
  if (look === undefined) return values;
  const own = Object.fromEntries(
    Object.entries(values)
      .map(([name, value]) => [name, ownValue(name, value, look[name])] as const)
      .filter(([, value]) => value !== undefined),
  );
  return { ...look, ...own } as Values;
}

/**
 * The value of each field `type`'s item draws with (#670): its own, else its kind's look in
 * `looks`, else its component's default; with where each came from.
 */
export function effectiveValues(
  type: string,
  values: Readonly<Record<string, unknown>>,
  defaults: Readonly<Record<string, unknown>>,
  looks: Looks | undefined,
): {
  readonly values: Readonly<Record<string, unknown>>;
  readonly sources: Readonly<Record<string, ValueSource>>;
} {
  const look: Readonly<Record<string, unknown>> = looks?.[type] ?? {};
  const merged: Record<string, unknown> = {};
  const sources: Record<string, ValueSource> = {};
  for (const name of new Set([
    ...Object.keys(defaults),
    ...Object.keys(look),
    ...Object.keys(values),
  ])) {
    const looked = look[name];
    const [own, fallback] = [ownValue(name, values[name], looked), defaults[name]];
    if (own !== undefined) {
      merged[name] = own;
      sources[name] = "own";
    } else if (looked !== undefined) {
      merged[name] = looked;
      sources[name] = "look";
    } else if (fallback !== undefined) {
      merged[name] = fallback;
      sources[name] = "default";
    }
  }
  return { values: merged, sources };
}
