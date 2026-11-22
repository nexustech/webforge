import { type ColorRef, formatColorRef, parseColorRef } from "./color-ref.js";
import type { NodeDoc } from "./documents.js";
import type { SiteDoc } from "./site-doc.js";
import { eachElement } from "./site-elements.js";

/**
 * The person's own colours in the theme (TC-1b, #1218): a new colour's id, and every use of one
 * across the site, to count or to rewrite, as Theme Studio's delete does. A use is a colour field's
 * value `own-<id>[-<shade>][/<opacity>]`: on an element, in a list's item, for one device
 * (`$responsive`), or in a kind of element's look in the theme.
 */

/**
 * Whether `field` of a `type` element is a colour field: `lookBackground`, or a list item's
 * `items.icon` as `<list>.<field>`. Only a colour field's value is a use; a text that happens to
 * read `own-sky` isn't one.
 */
export type IsColorField = (type: string, field: string) => boolean;

/** What {@link colorFieldsIn} reads of a component: its fields' kinds, a list's items' too. */
export type FieldKinds = {
  readonly fields: Readonly<
    Record<
      string,
      | {
          readonly kind: string;
          readonly fields?: Readonly<Record<string, { readonly kind: string } | undefined>>;
        }
      | undefined
    >
  >;
};

/**
 * Which fields of `components` hold colours: a `color` field, or a list item's
 * (`items.iconColor`), as the editor's library or the catalogue for AI apps has them (#1218).
 */
export const colorFieldsIn =
  (components: Readonly<Record<string, FieldKinds | undefined>>): IsColorField =>
  (type, field) => {
    const fields = components[type]?.fields;
    if (fields === undefined) return false;
    const [name = "", item] = field.split(".");
    const def = fields[name];
    if (item === undefined) return def?.kind === "color";
    return def?.kind === "list" && def.fields?.[item]?.kind === "color";
  };

/** The letters a new colour's id is made of: lower case, as the id's pattern takes them. */
const ID_LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** How many letters a new colour's id has after its first: plenty for a theme's few hundred. */
const ID_LENGTH = 7;

/**
 * A new colour's id, unlike any of `taken` (TC-1b): lower-case letters, which the id's pattern
 * takes and CSS reads as a name. It never changes, so renaming the colour changes no use of it.
 */
export function newOwnColorId(taken: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set(taken);
  for (;;) {
    let id = "c";
    for (let n = 0; n < ID_LENGTH; n++) id += ID_LETTERS[Math.floor(random() * ID_LETTERS.length)];
    if (!used.has(id)) return id;
  }
}

/** What a use of colour `id` becomes: its new value, or as it was. */
type Rewrite = (ref: ColorRef) => string;

/**
 * `value`, a colour field's, with each use of colour `id` in it given to `rewrite`, and how many
 * there were: a plain value, or one for each device.
 */
function rewriteValue(value: unknown, id: string, rewrite?: Rewrite): [unknown, number] {
  if (typeof value === "string") {
    const ref = parseColorRef(value);
    if (ref === undefined || !("own" in ref.base) || ref.base.own !== id) return [value, 0];
    return [rewrite === undefined ? value : rewrite(ref), 1];
  }
  if (typeof value === "object" && value !== null && "$responsive" in value) {
    const devices = (value as { $responsive: Record<string, unknown> }).$responsive;
    let uses = 0;
    for (const [device, each] of Object.entries(devices)) {
      const [next, found] = rewriteValue(each, id, rewrite);
      uses += found;
      if (found > 0 && rewrite !== undefined) devices[device] = next;
    }
    return [value, uses];
  }
  return [value, 0];
}

/** Rewrites, or counts, the uses of colour `id` in `props`, a `type` element's or its look's. */
function rewriteProps(
  props: Record<string, unknown>,
  type: string,
  id: string,
  isColorField: IsColorField,
  rewrite?: Rewrite,
): number {
  let uses = 0;
  for (const [field, value] of Object.entries(props)) {
    if (isColorField(type, field)) {
      const [next, found] = rewriteValue(value, id, rewrite);
      uses += found;
      if (found > 0 && rewrite !== undefined) props[field] = next;
    } else if (Array.isArray(value)) {
      // A list's items: their own colour fields, as `<list>.<field>`.
      for (const item of value) {
        if (typeof item !== "object" || item === null || "props" in item) continue;
        const record = item as Record<string, unknown>;
        for (const [name, each] of Object.entries(record)) {
          if (!isColorField(type, `${field}.${name}`)) continue;
          const [next, found] = rewriteValue(each, id, rewrite);
          uses += found;
          if (found > 0 && rewrite !== undefined) record[name] = next;
        }
      }
    }
  }
  return uses;
}

/** Visits every element of `site` and every kind's look in its theme, with its props and type. */
function eachUseHolder(
  site: SiteDoc,
  visit: (props: Record<string, unknown>, type: string) => void,
): void {
  eachElement(site, (node: NodeDoc) => visit(node.props, node.type));
  for (const [type, look] of Object.entries(site.theme.looks ?? {})) {
    if (look !== undefined) visit(look as Record<string, unknown>, type);
  }
}

/** How many times colour `id` is used across `site`: by elements, list items and looks. */
export function countOwnColorUses(site: SiteDoc, id: string, isColorField: IsColorField): number {
  let uses = 0;
  eachUseHolder(site, (props, type) => {
    uses += rewriteProps(props, type, id, isColorField);
  });
  return uses;
}

/**
 * Rewrites every use of colour `id` across `site`, a draft, as `rewrite` makes it from the use's
 * shade and opacity: to another of the person's colours, or to a one-off hex colour of its own.
 * How many there were.
 */
export function rewriteOwnColorUses(
  site: SiteDoc,
  id: string,
  isColorField: IsColorField,
  rewrite: Rewrite,
): number {
  let uses = 0;
  eachUseHolder(site, (props, type) => {
    uses += rewriteProps(props, type, id, isColorField, rewrite);
  });
  return uses;
}

/** A use of colour `id` given to another of the person's colours, `to`, its shade and opacity kept. */
export const toOwnColor =
  (to: string): Rewrite =>
  (ref) =>
    formatColorRef({ ...ref, base: { own: to } });
