// The catalogue as plain data (4.8, architecture §4): each component's name, place, fields and
// defaults, without React or the components themselves, so `packages/commands` (and the MCP
// server's tools after it) can read what a component has and check what is set on it.
// `catalogue-data.json` is written from the library by `pnpm catalogue-data`; a test fails when it
// is stale.

import {
  BOX_SIDES,
  boxValueSchema,
  colorRefSchema,
  imageValueSchema,
  linkValueSchema,
} from "@webforge/model";
import { z } from "zod";
import data from "./catalogue-data.json" with { type: "json" };

const optionSchema = z.strictObject({ label: z.string(), value: z.string() });

/** What every field has, whatever its kind. */
const common = {
  label: z.string(),
  group: z.enum(["content", "style"]).optional(),
  help: z.string().optional(),
  responsive: z.boolean().optional(),
  optionGroup: z.strictObject({ id: z.string(), label: z.string() }).optional(),
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
});

/** See {@link catalogueComponentSchema}. */
export type CatalogueComponent = z.infer<typeof catalogueComponentSchema>;

/** The whole catalogue as data, by component type. */
export const catalogueSchema = z.record(z.string(), catalogueComponentSchema);

/** See {@link catalogueSchema}. */
export type Catalogue = z.infer<typeof catalogueSchema>;

/** Webforge's site components as data (`catalogue-data.json`). */
export const CATALOGUE: Catalogue = catalogueSchema.parse(data);

/** A value set per device (F-ED-4), or one for all. */
const responsive = (schema: z.ZodType) =>
  z.union([
    schema,
    z.strictObject({
      $responsive: z.strictObject({
        desktop: schema,
        tablet: schema.optional(),
        mobile: schema.optional(),
      }),
    }),
  ]);

const optionValues = (options: readonly { readonly value: string }[]) => {
  const [first, ...rest] = options.map((option) => option.value);
  return first === undefined ? z.never() : z.enum([first, ...rest]);
};

/**
 * What `field` may hold, as a zod schema: a select's value one of its options, a link a link, an
 * image an image… A slot holds elements (whose types its `allow` checks elsewhere), and `code`
 * none, as nothing outside the editor may write Custom Code.
 */
export function fieldValueSchema(field: CatalogueField): z.ZodType {
  const value = ((): z.ZodType => {
    switch (field.kind) {
      case "text":
      case "richtext":
      case "icon":
        return z.string().max(20_000);
      case "select":
      case "spacing":
        return optionValues(field.options);
      case "slider":
        return optionValues(field.steps);
      case "color":
        return z.union([optionValues(field.options), colorRefSchema]);
      case "toggle":
        return z.boolean();
      case "box":
        return boxValueSchema;
      case "media":
        return imageValueSchema;
      case "link":
        return linkValueSchema;
      case "slot":
        return z.array(z.unknown());
      case "code":
        return z.never();
      case "list": {
        const item = z.strictObject({
          id: z.string().min(1).max(64),
          ...Object.fromEntries(
            Object.entries(field.fields).map(([name, itemField]) => [
              name,
              fieldValueSchema(itemField).optional(),
            ]),
          ),
        });
        return z.array(item).max(100);
      }
    }
  })();
  return field.responsive === true ? responsive(value) : value;
}
