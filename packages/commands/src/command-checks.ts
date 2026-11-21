import { t } from "@webforge/i18n";
import {
  isNodeDoc,
  isPageIn,
  isResponsiveValue,
  linkValueSchema,
  type NodeDoc,
  newId,
  type PageEntry,
  pageEntryOf,
  parseColorRef,
  richTextFileLinks,
  richTextPageLinks,
  type SiteDoc,
} from "@webforge/model";
import {
  CATALOGUE,
  type CatalogueComponent,
  type CatalogueField,
  fieldValueSchema,
  sanitizeStoredRichText,
} from "@webforge/site-components/catalogue-data";
import { z } from "zod";
import { offLimits } from "./catalogue.js";
import { isSlot, type Location, locate, nodesAt, type Placed, pagesShowing } from "./locations.js";
import { type Failure, fail, type Plan } from "./plan.js";

// What the commands share (#986, out of `commands.ts`): looking a component up in the catalogue,
// checking values and placements, new ids, and the questions a change asks (D7, S18).

/** Whether a field is about what an element says (Content mode's), not how it looks. */
export function isContent(field: CatalogueField): boolean {
  if (field.group !== undefined) return field.group === "content";
  return !["select", "toggle", "slider", "color", "spacing", "box"].includes(field.kind);
}

/**
 * The component of `type`, or why there's none an AI app may use. For a type there isn't, `goes`
 * lists the types that would do (AIB-1).
 */
export function componentOf(
  type: string,
  goes?: () => readonly string[],
): CatalogueComponent | Failure {
  const component = Object.hasOwn(CATALOGUE, type) ? CATALOGUE[type] : undefined;
  if (component === undefined) {
    const valid = goes?.() ?? [];
    return fail(
      "invalid",
      valid.length === 0
        ? `There is no component "${type}". The components query lists them.`
        : `There is no component "${type}". These go there: ${valid.join(", ")}.`,
    );
  }
  if (offLimits(component)) {
    return fail("refused", `AI apps can't add or edit ${component.label}.`);
  }
  return component;
}

/**
 * Why AI apps can't move or remove `node`: it, or something in its slots at any depth, is a
 * component they keep away from (S19). `undefined` when they can.
 */
export function untouchable(node: NodeDoc): Failure | undefined {
  const pending: NodeDoc[] = [node];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const component = CATALOGUE[next.type];
    if (component !== undefined && offLimits(component)) {
      return fail(
        "refused",
        next === node
          ? `AI apps can't move or remove ${component.label}.`
          : `AI apps can't move or remove this: it holds ${component.label}.`,
      );
    }
    for (const value of Object.values(next.props)) {
      if (isSlot(value)) pending.push(...value);
    }
  }
  return undefined;
}

/**
 * `values` checked against `component`'s fields: each a field it has, not a slot or Custom Code,
 * of the field's kind. A message says which is wrong.
 */
function checkedValues(
  component: CatalogueComponent,
  values: Readonly<Record<string, unknown>>,
): string | undefined {
  for (const [name, value] of Object.entries(values)) {
    // Its own fields only: `constructor` or `toString` would reach Object's (5.6).
    const field = Object.hasOwn(component.fields, name) ? component.fields[name] : undefined;
    if (field === undefined || field.kind === "slot" || field.kind === "code") {
      return `${component.label} has no field "${name}" an AI app can set.`;
    }
    const checked = fieldValueSchema(field).safeParse(value);
    if (!checked.success) {
      return `"${name}" isn't a valid ${field.kind}: ${z.prettifyError(checked.error)}`;
    }
  }
  return undefined;
}

/**
 * The first page or file in Media that `value` names (a link, an image, a list's items, a value
 * per device) and `site` doesn't have, as a message.
 */
function missingReference(site: SiteDoc, value: unknown): string | undefined {
  if (typeof value === "string") {
    // Rich text's links to the site's pages and documents (`webforge:page/…`, `webforge:file/…`).
    const page = richTextPageLinks(value).find(({ pageId }) => site.pages[pageId] === undefined);
    if (page !== undefined) return `There is no page "${page.pageId}".`;
    const file = richTextFileLinks(value).find(({ mediaId }) => site.media[mediaId] === undefined);
    return file === undefined ? undefined : `There is no file "${file.mediaId}" in Media.`;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const missing = missingReference(site, item);
      if (missing !== undefined) return missing;
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const named = value as Record<string, unknown>;
  if (typeof named.mediaId === "string" && site.media[named.mediaId as never] === undefined) {
    return `There is no file "${named.mediaId}" in Media.`;
  }
  if (
    named.kind === "page" &&
    typeof named.pageId === "string" &&
    !isPageIn(site.pages, named.pageId)
  ) {
    return `There is no page "${named.pageId}".`;
  }
  return missingReference(site, Object.values(named));
}

/**
 * `values` for `component` as the site will hold them, or why not: each checked against its
 * field's schema, rich text cleaned as the editor's is, and no link or image to a page or file the
 * site doesn't have. Nothing an AI app sets is what no person could have set.
 */
export function storedValues(
  site: SiteDoc,
  component: CatalogueComponent,
  values: Readonly<Record<string, unknown>>,
): { readonly values: Record<string, unknown> } | Failure {
  const invalid = checkedValues(component, values);
  if (invalid !== undefined) return fail("invalid", invalid);
  const stored = Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      component.fields[name]?.kind === "richtext" && typeof value === "string"
        ? sanitizeStoredRichText(value)
        : value,
    ]),
  );
  const missing = missingReference(site, stored) ?? missingOwnColour(site, component, stored);
  return missing === undefined ? { values: stored } : fail("not-found", missing);
}

/**
 * The first of the person's own colours (TC-1a, #1217) a colour field in `values` names that the
 * site's theme doesn't have, as a message: it would draw nothing. Colour fields only, one value or
 * one per device; a text that reads `own-sky` is only text.
 */
function missingOwnColour(
  site: SiteDoc,
  component: CatalogueComponent,
  values: Readonly<Record<string, unknown>>,
): string | undefined {
  const ids = new Set((site.theme.ownColors ?? []).map(({ id }) => id));
  for (const [name, value] of Object.entries(values)) {
    if (component.fields[name]?.kind !== "color") continue;
    const each = isResponsiveValue(value) ? Object.values(value.$responsive) : [value];
    for (const ref of each) {
      const parsed = typeof ref === "string" ? parseColorRef(ref) : undefined;
      if (parsed !== undefined && "own" in parsed.base && !ids.has(parsed.base.own)) {
        return `The theme has no colour "${parsed.base.own}" of its own: the theme query lists them.`;
      }
    }
  }
  return undefined;
}

/** `node` and everything in its slots, with new ids: a component's defaults keep theirs. */
export function withNewIds(node: NodeDoc): NodeDoc {
  const props = Object.fromEntries(
    Object.entries(node.props).map(([name, value]) => [
      name,
      Array.isArray(value) && value.length > 0 && value.every(isNodeDoc)
        ? value.map(withNewIds)
        : value,
    ]),
  );
  return { type: node.type, props: { ...props, id: newId("node") } };
}

/** Whether a node of `type` can go in `slot` of `parent`, or at the top level of `location`. */
export function canGo(
  type: string,
  location: Location,
  parent: NodeDoc | null,
  slot: string | null,
): string | undefined {
  const component = CATALOGUE[type];
  const place = component?.place ?? "element";
  if (parent === null || slot === null) {
    if (location.kind === "page" && place === "section") return undefined;
    return location.kind === "page"
      ? `Only sections go at the top of a page; put ${component?.label ?? type} in a section.`
      : "Elements go in a section's slot here, not at the top.";
  }
  const field = CATALOGUE[parent.type]?.fields[slot];
  if (field?.kind !== "slot") return `${parent.type} has no slot "${slot}".`;
  const allowed =
    field.allow !== undefined ? field.allow.includes(type) : (field.accepts ?? "element") === place;
  if (!allowed) return `${component?.label ?? type} can't go in ${parent.type}'s ${slot}.`;
  return undefined;
}

/** The node `nodeId` at `location` in `site`, or why it isn't there. */
export function find(site: SiteDoc, location: Location, nodeId: string): Placed | Failure {
  const nodes = nodesAt(site, location);
  if (nodes === undefined) return fail("not-found", "That page or shared section isn't there.");
  return locate(nodes, nodeId) ?? fail("not-found", `There is no element "${nodeId}" there.`);
}

/** The confirmation a change at `location` needs, if it shows on more than one page (D7). */
export function confirmationAt(site: SiteDoc, location: Location): Plan["confirm"] {
  const count = pagesShowing(site, location);
  if (location.kind === "page" || count <= 1) return undefined;
  const confirm = t("ai.confirm.allow");
  if (location.kind === "layout") {
    const part = t(`ai.part.${location.part}`);
    return (app) => ({
      action: t("ai.confirm.layout", { app, part }),
      confirm,
      affectedPages: count,
    });
  }
  const name = site.sharedSections[location.sharedSectionId as never]?.name ?? "";
  return (app) => ({
    action: t("ai.confirm.shared", { app, name }),
    confirm,
    affectedPages: count,
  });
}

/**
 * Where a sensitive field's value sends visitors, as text to compare and show: the text itself, or
 * a link's address (a web address, `mailto:`, `tel:`, a page or a Media file by its id), so a
 * link field marked sensitive asks as a text one does (5.6).
 */
function addressOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const link = linkValueSchema.safeParse(value);
  if (!link.success) return "";
  switch (link.data.kind) {
    case "url":
      return link.data.href;
    case "email":
      return `mailto:${link.data.address}`;
    case "phone":
      return `tel:${link.data.number}`;
    case "page":
      return `page:${link.data.pageId}${link.data.anchor === undefined ? "" : `#${link.data.anchor}`}`;
    case "file":
      return `file:${link.data.mediaId}`;
    case "list":
      return `list:${link.data.collectionId}`;
  }
}

/**
 * `address` as a browser reads it (WHATWG URL), or `undefined` for text that isn't a web address:
 * `\` taken as `/`, `../` resolved, and a look-alike host in punycode (`xn--…`), so a question
 * names where visitors really go.
 */
function webAddress(address: string): { readonly host: string; readonly href: string } | undefined {
  try {
    const { host, href } = new URL(address);
    return host === "" ? undefined : { host, href };
  } catch {
    return undefined;
  }
}

/** The most of an address a confirmation shows; a longer one is cut in the middle. */
const SHOWN_MAX_CHARS = 400;

/**
 * `address` as a confirmation names it: as a browser reads it, and cut in the middle past
 * {@link SHOWN_MAX_CHARS}, keeping its start (the host) and its end (where on the host).
 */
function shown(address: string): string {
  if (address === "") return t("ai.confirm.noAddress");
  const read = webAddress(address)?.href ?? address;
  if (read.length <= SHOWN_MAX_CHARS) return read;
  const start = 100;
  return `${read.slice(0, start)}…${read.slice(read.length - (SHOWN_MAX_CHARS - start - 1))}`;
}

/**
 * Where a field sends visitors before and after a change, as a confirmation names them: each
 * address's host, or the whole addresses when the hosts are the same (a payment page of another
 * account on the same service) or one isn't a web address.
 */
function fromTo(before: string, after: string): { readonly from: string; readonly to: string } {
  const from = webAddress(before)?.host;
  const to = webAddress(after)?.host;
  return from !== undefined && to !== undefined && from !== to
    ? { from, to }
    : { from: shown(before), to: shown(after) };
}

/**
 * The confirmation setting `values` on an element of `component` that has `before` needs at
 * `location` (D7): asked always when a field saying where visitors' money or details go changes
 * (S18), naming where it goes now and would go; otherwise as {@link confirmationAt} says.
 */
export function confirmationFor(
  site: SiteDoc,
  location: Location,
  component: CatalogueComponent,
  before: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, unknown>>,
): Plan["confirm"] {
  const changed = Object.entries(values).flatMap(([name, value]) => {
    const field = component.fields[name];
    const [was, now] = [addressOf(before[name]), addressOf(value)];
    return field?.sensitive === true && was !== now
      ? [{ field: field.label, ...fromTo(was, now) }]
      : [];
  });
  const [first] = changed;
  if (first === undefined) return confirmationAt(site, location);
  const pages = pagesShowing(site, location);
  return (app) => ({
    action: t("ai.confirm.destination", { app, item: component.label, field: first.field }),
    description: changed.map((change) => t("ai.confirm.destinationFromTo", change)).join(" "),
    confirm: t("ai.confirm.allow"),
    affectedPages: pages,
    first: true,
  });
}

/** Page `pageId` of `site`, or why it isn't there. */
export function pageOf(site: SiteDoc, pageId: string): PageEntry | Failure {
  return (
    pageEntryOf(site.pages, pageId) ??
    fail("not-found", `There is no page "${pageId}". The outline lists them.`)
  );
}

/** "page 'About'", for the history's "Deleted {item}" labels, as the Pages panel's. */
export const pageItem = (title: string) => t("pages.item", { name: title });

export const nodeId = z.string().min(1).max(200);
export const values = z.record(z.string(), z.unknown());
export const placement = {
  parentId: nodeId.nullable().default(null),
  slot: z.string().min(1).max(64).nullable().default(null),
  index: z.int().min(0).optional(),
};

export const pageId = z.string().min(1).max(200).describe("A page's id, as the outline gives it.");

/** The list in `slot` of the node `parentId` among `nodes`, made if it isn't there yet. */
export function childrenOf(
  nodes: NodeDoc[],
  parentId: string,
  slot: string,
): NodeDoc[] | undefined {
  const parent = locate(nodes, parentId)?.node;
  if (parent === undefined) return undefined;
  const list = parent.props[slot];
  if (isSlot(list)) return list;
  const made: NodeDoc[] = [];
  parent.props[slot] = made;
  return made;
}
