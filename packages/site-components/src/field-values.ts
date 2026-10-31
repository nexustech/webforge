// What a component's field may hold (#667): one rule for the Edit panel, its copy and paste, list
// edits, canvas drags, and what an AI app sets (packages/commands). Without React or the catalogue's
// data, so every one of them can load it.

import { boxValueSchema, colorRefSchema, imageValueSchema, linkValueSchema } from "@webforge/model";
import { z } from "zod";

/** A choice of a select, a slider's step: its value is what the field stores. */
type OptionValue = { readonly value: string };

/**
 * What {@link fieldValueSchema} reads of a field: its kind, and the options, steps or item fields
 * the kind has. A component's field (`FieldDef`) and the catalogue's (`CatalogueField`) both are.
 */
export type FieldValueShape = { readonly responsive?: boolean | undefined } & (
  | {
      readonly kind:
        | "text"
        | "richtext"
        | "icon"
        | "toggle"
        | "box"
        | "media"
        | "link"
        | "slot"
        | "code";
    }
  | { readonly kind: "select" | "spacing" | "color"; readonly options: readonly OptionValue[] }
  | { readonly kind: "slider"; readonly steps: readonly OptionValue[] }
  | { readonly kind: "list"; readonly fields: Readonly<Record<string, FieldValueShape>> }
);

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

const optionValues = (options: readonly OptionValue[]) => {
  const [first, ...rest] = options.map((option) => option.value);
  return first === undefined ? z.never() : z.enum([first, ...rest]);
};

/**
 * What `field` may hold, as a zod schema: a select's value one of its options, a link a link, an
 * image an image… A slot holds elements (whose types its `allow` checks elsewhere), and `code`
 * none, as nothing outside the editor may write Custom Code.
 */
export function fieldValueSchema(field: FieldValueShape): z.ZodType {
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

/** Each field's schemas, one value and one per device: a field's options don't change. */
const schemas = new WeakMap<FieldValueShape, { one?: z.ZodType; perDevice?: z.ZodType }>();

/**
 * Whether `value` is something `field` may hold, by {@link fieldValueSchema}: what the Edit panel
 * changes and pastes, an item's field in a list, a canvas drag. With `responsive: false`, one
 * device's value, as the Edit panel and a drag set it; with `true`, what the document stores.
 *
 * Besides what an AI app may set: none, to take an image or an icon away, and Custom Code, which
 * only the person writes, in the editor.
 */
export function acceptsFieldValue(
  field: FieldValueShape,
  value: unknown,
  options: { readonly responsive: boolean },
): boolean {
  if (value === undefined) return field.kind === "media" || field.kind === "icon";
  if (field.kind === "code") return typeof value === "string";
  const cached = schemas.get(field) ?? {};
  schemas.set(field, cached);
  const which = options.responsive && field.responsive === true ? "perDevice" : "one";
  const schema =
    cached[which] ?? fieldValueSchema(which === "one" ? { ...field, responsive: false } : field);
  cached[which] = schema;
  return schema.safeParse(value).success;
}
