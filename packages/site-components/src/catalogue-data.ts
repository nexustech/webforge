// The catalogue as plain data (4.8, architecture §4): each component's name, place, fields and
// defaults, without React or the components themselves, so `packages/commands` (and the MCP
// server's tools after it) can read what a component has and check what is set on it.
// `catalogue-data.json` is written from the library by `pnpm catalogue-data`; a test fails when it
// is stale.

import {
  BOX_SIDES,
  isResponsiveValue,
  type Responsive,
  resolveResponsive,
  TEXT_STYLES,
  type TextStyle,
} from "@webforge/model";
import { z } from "zod";
import data from "./catalogue-data.json" with { type: "json" };

// What a field may hold (#667), the rule the editor uses too.
export { fieldValueSchema } from "./field-values.js";
// The fields a component's layout or values leave unused, as the Edit panel hides them (#670).
export { hiddenFieldsOf, hideableFieldsOf } from "./hidden-fields.js";
export { drawsPictureBehind } from "./picture-behind.js";
// Rich text from outside the editor is cleaned as the editor's is (4.8).
export { sanitizeStoredRichText } from "./rich-text-html.js";

const optionSchema = z.strictObject({ label: z.string(), value: z.string() });

/** What every field has, whatever its kind. */
const common = {
  label: z.string(),
  group: z.enum(["content", "style"]).optional(),
  help: z.string().optional(),
  responsive: z.boolean().optional(),
  optionGroup: z.strictObject({ id: z.string(), label: z.string() }).optional(),
  /** Shown only in *Style this ‹component›…* (3.13b): the dialog's deeper groups. */
  inDialog: z.literal(true).optional(),
  /** Where visitors' money or details go: an AI app's change to it is asked first (S18). */
  sensitive: z.literal(true).optional(),
};

const listItemFieldSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...common, kind: z.literal("text"), inline: z.boolean().optional() }),
  z.strictObject({ ...common, kind: z.literal("select"), options: z.array(optionSchema) }),
  z.strictObject({ ...common, kind: z.literal("toggle") }),
  z.strictObject({
    ...common,
    kind: z.literal("slider"),
    steps: z.array(optionSchema),
    widths: z.record(z.string(), z.number().nullable()).optional(),
  }),
  z.strictObject({ ...common, kind: z.literal("color"), options: z.array(optionSchema) }),
  z.strictObject({ ...common, kind: z.literal("spacing"), options: z.array(optionSchema) }),
]);

/** A component's field as data: its kind and what the kind needs (a select's options…). */
export const catalogueFieldSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("text"),
    inline: z.boolean().optional(),
    bindable: z.array(z.string()).optional(),
  }),
  z.strictObject({ ...common, kind: z.literal("richtext"), inline: z.boolean().optional() }),
  ...listItemFieldSchema.options.slice(1),
  z.strictObject({
    ...common,
    kind: z.literal("box"),
    property: z.enum(["padding", "margin"]),
    sides: z.array(z.enum(BOX_SIDES)).optional(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("slot"),
    allow: z.array(z.string()).optional(),
    accepts: z.enum(["section", "element", "layout", "child"]).optional(),
    max: z.int().positive().optional(),
  }),
  z.strictObject({ ...common, kind: z.literal("media") }),
  z.strictObject({ ...common, kind: z.literal("link") }),
  z.strictObject({ ...common, kind: z.literal("code") }),
  z.strictObject({ ...common, kind: z.literal("icon") }),
  z.strictObject({
    ...common,
    kind: z.literal("list"),
    itemLabel: z.string(),
    fields: z.record(z.string(), listItemFieldSchema),
    defaults: z.record(z.string(), z.unknown()),
  }),
]);

/** See {@link catalogueFieldSchema}. */
export type CatalogueField = z.infer<typeof catalogueFieldSchema>;

/** A component as data: what the Add panel calls it, where it goes, its fields and defaults. */
export const catalogueComponentSchema = z.strictObject({
  label: z.string(),
  place: z.enum(["section", "element", "layout", "child"]),
  category: z.string().optional(),
  advancedOnly: z.literal(true).optional(),
  framed: z.literal(true).optional(),
  presets: z
    .array(
      z.strictObject({
        id: z.string(),
        label: z.string(),
        values: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
  fields: z.record(z.string(), catalogueFieldSchema),
  defaults: z.record(z.string(), z.unknown()),
  /** Its colour colours a drawing, not text: graphics need 3:1, not 4.5:1 (WCAG 1.4.11, #670). */
  graphic: z.literal(true).optional(),
  /** The pictures it draws behind its content, and in which layouts: see `drawsPictureBehind`. */
  pictureBehind: z
    .array(z.strictObject({ field: z.string(), variants: z.array(z.string()).optional() }))
    .optional(),
  /** The fields each layout doesn't use (#311): its pictures aren't exported, nor checked (#670). */
  variantHides: z.record(z.string(), z.array(z.string())).optional(),
  /**
   * The text style its text is set in (#670): one, or one for each value of a field (a Heading's
   * size), so Site Check knows how much contrast it needs, as the colour field does.
   */
  textStyle: z
    .union([
      z.enum(TEXT_STYLES),
      z.strictObject({ field: z.string(), styles: z.record(z.string(), z.enum(TEXT_STYLES)) }),
    ])
    .optional(),
});

/** See {@link catalogueComponentSchema}. */
export type CatalogueComponent = z.infer<typeof catalogueComponentSchema>;

/** The whole catalogue as data, by component type. */
export const catalogueSchema = z.record(z.string(), catalogueComponentSchema);

/** See {@link catalogueSchema}. */
export type Catalogue = z.infer<typeof catalogueSchema>;

/**
 * The Appearance group's Text controls (2.22b): a section without a title of its own has the group
 * without them. Their names as `appearance.ts` has them; a test checks they agree.
 */
export const APPEARANCE_TEXT_FIELDS = [
  "lookFont",
  "lookSize",
  "lookWeight",
  "lookItalic",
  "lookUnderline",
  "lookCase",
  "lookAlign",
] as const;

/**
 * `catalogue-data.json` as written: the styling fields every section and element has once, the
 * Appearance group's (2.22) and *Style this ‹component›…*'s deeper ones (3.13b), each component
 * with `appearance`, `"all"` or `"noText"` (a section without a title), in place of them repeated
 * in it; and the dialog's fields for elements and for titled sections once too, each component
 * with `deeper` naming which it has. {@link CATALOGUE} puts them back.
 */
export const catalogueFileSchema = z.strictObject({
  appearance: z.record(z.string(), catalogueFieldSchema),
  /** The dialog's Spacing for elements (3.13b): every element has it. */
  element: z.record(z.string(), catalogueFieldSchema),
  /** The dialog's Title group (3.13b): every section with a title of its own has it. */
  titled: z.record(z.string(), catalogueFieldSchema),
  components: z.record(
    z.string(),
    catalogueComponentSchema.extend({
      appearance: z.enum(["all", "noText"]).optional(),
      /** Which of `element` and `titled` it has, after the shared group. */
      deeper: z.enum(["element", "titled"]).optional(),
    }),
  ),
});

/** See {@link catalogueFileSchema}. */
export type CatalogueFile = z.infer<typeof catalogueFileSchema>;

/** The catalogue `file` holds, each component's Appearance fields first, as the library has them. */
export function expandCatalogue(file: CatalogueFile): Catalogue {
  return Object.fromEntries(
    Object.entries(file.components).map(([type, { appearance, deeper, ...component }]) => {
      const group =
        appearance === undefined
          ? {}
          : Object.fromEntries(
              Object.entries(file.appearance).filter(
                ([name]) =>
                  appearance === "all" ||
                  !(APPEARANCE_TEXT_FIELDS as readonly string[]).includes(name),
              ),
            );
      const own = deeper === undefined ? {} : file[deeper];
      return [type, { ...component, fields: { ...group, ...own, ...component.fields } }];
    }),
  );
}

/** Webforge's site components as data (`catalogue-data.json`), the Appearance group put back. */
export const CATALOGUE: Catalogue = expandCatalogue(catalogueFileSchema.parse(data));

/**
 * The text styles `component`'s text is set in with `values` (#670): one, or one for each device
 * its field's value differs on; none for a component that declares none.
 */
export function textStylesIn(
  component: Pick<CatalogueComponent, "textStyle">,
  values: Readonly<Record<string, unknown>>,
): TextStyle[] {
  const { textStyle } = component;
  if (textStyle === undefined) return [];
  if (typeof textStyle === "string") return [textStyle];
  const value = values[textStyle.field];
  const each = isResponsiveValue(value as Responsive<unknown>)
    ? (["desktop", "tablet", "mobile"] as const).map((device) =>
        resolveResponsive(value as Responsive<unknown>, device),
      )
    : [value];
  const styles = each.flatMap((one) =>
    typeof one === "string" && Object.hasOwn(textStyle.styles, one) ? [textStyle.styles[one]] : [],
  );
  return [...new Set(styles.filter((style) => style !== undefined))];
}
