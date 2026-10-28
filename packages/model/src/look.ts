import { z } from "zod";

/**
 * The fields a kind's look holds (3.12, CT-1): the Appearance group's, with a section's overlay over
 * its background image and the hover row's, which share its option group: the same fields 2.27's
 * *Apply this look* copies. The background image itself is content, so it isn't one.
 */
export const LOOK_FIELDS = [
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
] as const;

/** A field of a kind's look. */
export type LookField = (typeof LOOK_FIELDS)[number];

/** The look's colour fields: a theme role (with shade and opacity) only, never a custom colour. */
const COLOUR_FIELDS: ReadonlySet<LookField> = new Set([
  "lookColor",
  "lookBackground",
  "lookBorderColor",
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
const CUSTOM_COLOUR = /^\[#[0-9a-f]{6}\]/i;

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
