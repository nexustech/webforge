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

// What a field may hold (#667), the rule the editor uses too, and the icon names it takes (#1251).
export { fieldValueSchema, ICON_NAMES_TAKEN } from "./field-values.js";
// The fields a component's layout or values leave unused, as the Edit panel hides them (#670).
export { secondOfOne } from "./held-once.js";
export {
  FOOTER_COLUMN,
  type HidingParent,
  hiddenFieldsOf,
  hideableFieldsOf,
} from "./hidden-fields.js";
export { mainHeadingsOf, pageHeadings } from "./main-heading.js";
export { drawsPictureBehind } from "./picture-behind.js";
// Rich text from outside the editor is cleaned as the editor's is (4.8).
export { sanitizeStoredRichText } from "./rich-text-html.js";
export { TEXT_COLOUR_FIELDS } from "./text-colour-fields.js";

const optionSchema = z.strictObject({ label: z.string(), value: z.string() });

/** What every field has, whatever its kind. */
const common = {
  label: z.string(),
  group: z.enum(["content", "style"]).optional(),
  help: z.string().optional(),
  /** Another name the search finds it by: its CSS property. */
  alsoCalled: z.string().optional(),
  responsive: z.boolean().optional(),
  optionGroup: z.strictObject({ id: z.string(), label: z.string() }).optional(),
  /** Shown only in *Style this ‹component›…* (3.13b): the dialog's deeper groups. */
  inDialog: z.literal(true).optional(),
  /** Where visitors' money or details go: an AI app's change to it is asked first (S18). */
  sensitive: z.literal(true).optional(),
  /** What an item draws with while it has no value of its own: a gradient's end (CT-10). */
  unset: z.string().optional(),
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
    /** A date, `YYYY-MM-DD` or empty (#865). */
    inputType: z.literal("date").optional(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("richtext"),
    inline: z.boolean().optional(),
    /** Can show a field of the post it is drawn for, in a Blog's design (6.10a). */
    itemBindable: z.literal(true).optional(),
  }),
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
    once: z.array(z.string()).optional(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("media"),
    /** Can show the picture of the post it is drawn for, in a Blog's design (6.10a). */
    itemBindable: z.literal(true).optional(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("link"),
    /** The text field labelling the button it opens: text with no link is a finding (#1256). */
    button: z.string().optional(),
  }),
  z.strictObject({ ...common, kind: z.literal("code") }),
  /** Some of the site's pages by id (HF-8): the menu's to leave out, others to add, or any (HF-5). */
  z.strictObject({ ...common, kind: z.literal("pages"), from: z.enum(["menu", "others", "all"]) }),
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
   * The fields its column form doesn't use (HF-4, 5.39): a section's frame and its layout, hidden
   * while it is in a Footer column, whose type is `FooterColumn` (#1334). Not exported, nor checked.
   */
  columnHides: z.array(z.string()).optional(),
  /**
   * The fields shown only while a number field, its own or its parent's, is at least some number
   * (6.16c): a Table's headings and its rows' cells past its Columns. Not exported, nor checked.
   */
  shownAtLeast: z
    .record(
      z.string(),
      z.strictObject({
        field: z.string(),
        atLeast: z.int(),
        of: z.literal("parent").optional(),
      }),
    )
    .optional(),
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
  /** How it writes the page's main heading, `<h1>`, which Site Check counts: see `mainHeadingsOf`. */
  mainHeading: z
    .strictObject({
      field: z.string(),
      when: z.record(z.string(), z.string()).optional(),
      html: z.literal(true).optional(),
    })
    .optional(),
  /**
   * The field its title is in, a titled section's: the page's main heading on a page with none of
   * its own (#1173), as `pageHeadings` decides.
   */
  titleField: z.string().optional(),
  /** Nothing in it writes the page's main heading, as `pageHeadings` counts (a Footer column's). */
  noMainHeading: z.literal(true).optional(),
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

/**
 * The catalogue `file` holds, with each component's Appearance fields where the library has them:
 * first on an element; on a section after its own options, colours and overlay, its background and
 * box before its text (F23, #1180).
 */
export function expandCatalogue(file: CatalogueFile): Catalogue {
  const text: readonly string[] = APPEARANCE_TEXT_FIELDS;
  return Object.fromEntries(
    Object.entries(file.components).map(([type, { appearance, deeper, ...component }]) => {
      const section = component.place === "section";
      const shared = Object.entries(file.appearance).filter(
        ([name]) => appearance === "all" || !text.includes(name),
      );
      const group =
        appearance === undefined
          ? []
          : section
            ? // Its background and box, then its text, its colour last (SECTION_APPEARANCE_ORDER).
              [
                ...shared.filter(
                  ([name, field]) =>
                    !text.includes(name) && name !== "lookColor" && !field.inDialog,
                ),
                ...shared.filter(([name]) => text.includes(name) || name === "lookColor"),
                // The dialog's deeper fields (3.13b) after the group, as before.
                ...shared.filter(([, field]) => field.inDialog === true),
              ]
            : shared;
      const own = Object.entries(deeper === undefined ? {} : file[deeper]);
      const rest = Object.entries(component.fields);
      const names = rest.map(([name]) => name);
      const at = section ? Math.max(names.indexOf("colors"), names.indexOf("overlayColor")) + 1 : 0;
      const fields = Object.fromEntries([
        ...rest.slice(0, at),
        ...group,
        ...own,
        ...rest.slice(at),
      ]);
      return [type, { ...component, fields }];
    }),
  );
}

const FILE = catalogueFileSchema.parse(data);

/** Webforge's site components as data (`catalogue-data.json`), the Appearance group put back. */
export const CATALOGUE: Catalogue = expandCatalogue(FILE);

/**
 * The styling fields many components share, each defined once (#1250): the Appearance group's
 * (2.22), and *Style this ‹component›…*'s for elements and for titled sections (3.13b). A component
 * has some or all of them; its own fields are the rest.
 */
export const SHARED_STYLE_FIELDS: Readonly<Record<string, CatalogueField>> = {
  ...FILE.appearance,
  ...FILE.element,
  ...FILE.titled,
};

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
