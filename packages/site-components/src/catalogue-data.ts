// The catalogue as plain data (4.8, architecture §4): each component's name, place, fields and
// defaults, without React or the components themselves, so `packages/commands` (and the MCP
// server's tools after it) can read what a component has and check what is set on it.
// `catalogue-data.json` is written from the library by `pnpm catalogue-data`; a test fails when it
// is stale.

import { BOX_SIDES } from "@webforge/model";
import { z } from "zod";
import data from "./catalogue-data.json" with { type: "json" };

// What a field may hold (#667), the rule the editor uses too.
export { fieldValueSchema } from "./field-values.js";
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
