import { type ColorRef, formatColorRef, parseColorRef } from "./color-ref.js";
import type { NodeDoc } from "./documents.js";
import type { SiteDoc } from "./site-doc.js";
import { type ElementPlace, eachElement } from "./site-elements.js";

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

/** Which uses are counted or rewritten: of one of the person's colours, or of one one-off. */
type Matches = (ref: ColorRef) => boolean;

/** Uses of the person's colour `id`, whatever their shade and opacity. */
const usesOwn =
  (id: string): Matches =>
  (ref) =>
    "own" in ref.base && ref.base.own === id;

/** Uses of one-off colour `hex` (`#rrggbb`, ADR 0009), whatever their opacity. */
const usesOneOff = (hex: string): Matches => {
  const wanted = hex.toLowerCase();
  return (ref) => "hex" in ref.base && ref.base.hex === wanted;
};

/**
 * `value`, a colour field's, with each use `matches` finds in it given to `rewrite`, and how many
 * there were: a plain value, or one for each device.
 */
function rewriteValue(value: unknown, matches: Matches, rewrite?: Rewrite): [unknown, number] {
  if (typeof value === "string") {
    const ref = parseColorRef(value);
    if (ref === undefined || !matches(ref)) return [value, 0];
    return [rewrite === undefined ? value : rewrite(ref), 1];
  }
  if (typeof value === "object" && value !== null && "$responsive" in value) {
    const devices = (value as { $responsive: Record<string, unknown> }).$responsive;
    let uses = 0;
    for (const [device, each] of Object.entries(devices)) {
      const [next, found] = rewriteValue(each, matches, rewrite);
      uses += found;
      if (found > 0 && rewrite !== undefined) devices[device] = next;
    }
    return [value, uses];
  }
  return [value, 0];
}

/** Rewrites, or counts, the uses `matches` finds in `props`, a `type` element's or its look's. */
function rewriteProps(
  props: Record<string, unknown>,
  type: string,
  matches: Matches,
  isColorField: IsColorField,
  rewrite?: Rewrite,
): number {
  let uses = 0;
  for (const [field, value] of Object.entries(props)) {
    if (isColorField(type, field)) {
      const [next, found] = rewriteValue(value, matches, rewrite);
      uses += found;
      if (found > 0 && rewrite !== undefined) props[field] = next;
    } else if (Array.isArray(value)) {
      // A list's items: their own colour fields, as `<list>.<field>`.
      for (const item of value) {
        if (typeof item !== "object" || item === null || "props" in item) continue;
        const record = item as Record<string, unknown>;
        for (const [name, each] of Object.entries(record)) {
          if (!isColorField(type, `${field}.${name}`)) continue;
          const [next, found] = rewriteValue(each, matches, rewrite);
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
    uses += rewriteProps(props, type, usesOwn(id), isColorField);
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
    uses += rewriteProps(props, type, usesOwn(id), isColorField, rewrite);
  });
  return uses;
}

/**
 * How many times one-off colour `hex` is used across `site` (TC-3, #1221), at any opacity: each
 * element's or list item's field that has it, once, however many devices it's set for, as Theme
 * Studio's list counts them (TC-4). Its second use is when it's offered as one of the person's
 * colours.
 */
export function countOneOffUses(site: SiteDoc, hex: string, isColorField: IsColorField): number {
  const wanted = hex.toLowerCase();
  return oneOffUsesIn(site, isColorField).find((each) => each.hex === wanted)?.uses.length ?? 0;
}

/**
 * Rewrites every use of one-off colour `hex` across `site`, a draft, as `rewrite` makes it from
 * the use's opacity: to one of the person's colours it has become (TC-3). How many there were.
 */
export function rewriteOneOffUses(
  site: SiteDoc,
  hex: string,
  isColorField: IsColorField,
  rewrite: Rewrite,
): number {
  let uses = 0;
  eachUseHolder(site, (props, type) => {
    uses += rewriteProps(props, type, usesOneOff(hex), isColorField, rewrite);
  });
  return uses;
}

/**
 * A use given to one of the person's colours, `to`, its shade and opacity kept: another colour's
 * use, or a one-off's that has become `to` (TC-3).
 */
export const toOwnColor =
  (to: string): Rewrite =>
  (ref) =>
    formatColorRef({ ...ref, base: { own: to } });

/** A use of a one-off colour (TC-4): the element's place and id, and its colour field. */
export type OneOffUse = {
  readonly on: ElementPlace;
  readonly nodeId: string;
  /** The field: `lookBackground`, or a list item's as `<list>.<field>`. */
  readonly field: string;
};

/** A one-off colour on the site, `#rrggbb`, and its uses: each field that has it, once. */
export type OneOffInUse = { readonly hex: string; readonly uses: readonly OneOffUse[] };

/** The one-off colours `value` holds, a colour field's: as it is, or for each device. */
function oneOffsIn(value: unknown): Set<string> {
  const found = new Set<string>();
  const add = (each: unknown) => {
    if (typeof each !== "string") return;
    const ref = parseColorRef(each);
    if (ref !== undefined && "hex" in ref.base) found.add(ref.base.hex);
  };
  if (typeof value === "object" && value !== null && "$responsive" in value) {
    for (const each of Object.values(
      (value as { $responsive: Record<string, unknown> }).$responsive,
    )) {
      add(each);
    }
  } else {
    add(value);
  }
  return found;
}

/**
 * Every one-off colour across `site` and where it's used (TC-4, #1222): each element's colour
 * field, or list item's, that has it, at any opacity or device, once. The most used first, then
 * by code. A look can't hold one (ADR 0009), so only elements have them.
 */
export function oneOffUsesIn(site: SiteDoc, isColorField: IsColorField): readonly OneOffInUse[] {
  const uses = new Map<string, OneOffUse[]>();
  const found = (hex: string, use: OneOffUse) => {
    const list = uses.get(hex) ?? [];
    list.push(use);
    uses.set(hex, list);
  };
  eachElement(site, (node: NodeDoc, on) => {
    const nodeId = node.props.id;
    if (typeof nodeId !== "string") return;
    for (const [field, value] of Object.entries(node.props)) {
      if (isColorField(node.type, field)) {
        for (const hex of oneOffsIn(value)) found(hex, { on, nodeId, field });
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item !== "object" || item === null || "props" in item) continue;
          for (const [name, each] of Object.entries(item as Record<string, unknown>)) {
            if (!isColorField(node.type, `${field}.${name}`)) continue;
            for (const hex of oneOffsIn(each))
              found(hex, { on, nodeId, field: `${field}.${name}` });
          }
        }
      }
    }
  });
  return [...uses.entries()]
    .map(([hex, list]) => ({ hex, uses: list }))
    .sort((a, b) => b.uses.length - a.uses.length || a.hex.localeCompare(b.hex));
}
