import {
  BUSINESS_NAME_MAX,
  bindingOf,
  type ElementPlace,
  eachElement,
  findNode,
  isPageIn,
  MENU_LABEL_MAX,
  type NodeDoc,
  OPENING_HOURS_NOTE_MAX,
  PAGE_DESCRIPTION_MAX,
  PAGE_TITLE_MAX,
  type PageId,
  POSTAL_ADDRESS_MAX,
  SITE_DESCRIPTION_MAX,
  SITE_NAME_MAX,
  type SiteDoc,
} from "@webforge/model";
import { type ComponentLibrary, MAX_TEXT_LENGTH } from "@webforge/site-components";

// Find and replace across the site (6.2): the text the owner writes, wherever it is kept, searched
// and replaced without React, so the panel and its tests share one set of rules.

/** What to look for, as the panel's fields and options set it. */
export type FindOptions = {
  readonly query: string;
  /** Only text with the same capitals. */
  readonly matchCase: boolean;
  /** Only where the text is a word, or words, of its own: not "Smithson" for "Smith". */
  readonly wholeWords: boolean;
};

/** The page fields searched: its title, its label in the menu and its description (F-SET-2). */
type PageField = "title" | "navLabel" | "description";

/** Site Settings' business details searched: free text the owner writes (F-SET-1). */
const SETTINGS_FIELDS = [
  "general.name",
  "general.description",
  "contact.businessName",
  "contact.address",
  "contact.openingHoursNote",
] as const;
type SettingsField = (typeof SETTINGS_FIELDS)[number];

/** A piece of text the owner wrote: a field of an element, of a page or of Site Settings. */
export type TextSpot =
  | {
      readonly kind: "element";
      /** Where the element is kept: a page, the Header, the Footer or a shared section. */
      readonly on: ElementPlace;
      readonly nodeId: string;
      /** The component's type, to name it. */
      readonly type: string;
      readonly field: string;
      /** For a list's item: the item's id and its own field. */
      readonly item?: { readonly id: string; readonly field: string };
    }
  | { readonly kind: "page"; readonly pageId: PageId; readonly field: PageField }
  | { readonly kind: "settings"; readonly field: SettingsField };

/** One place the text was found, with what's on either side of it in its piece of text. */
export type FoundText = {
  readonly before: string;
  readonly found: string;
  readonly after: string;
};

/** A piece of text and what was found in it, in the order it reads. */
export type SpotMatches = {
  readonly spot: TextSpot;
  readonly matches: readonly FoundText[];
};

/** How much of the text around a match is kept, each side. */
const CONTEXT = 32;

/** Unicode letters, digits and the underscore: what a word is made of. */
const WORD = "[\\p{L}\\p{N}_]";

/** A regular expression for `options`, or `undefined` while there's nothing to find. */
export function matcher(options: FindOptions): RegExp | undefined {
  if (options.query === "") return undefined;
  const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = options.wholeWords ? `(?<!${WORD})${escaped}(?!${WORD})` : escaped;
  return new RegExp(body, options.matchCase ? "gu" : "giu");
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** A piece of rich text's text as it reads: its character references decoded. */
function decode(html: string): string {
  return html.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (reference, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? reference;
  });
}

/** Text to put between rich text's tags: what HTML reads as markup escaped. */
function encode(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * A value's pieces of text, in order: the whole of a plain-text value, or the text between rich
 * text's tags, each decoded with the raw markup it came from. Only text is searched and replaced,
 * so a mark or a link around a match stays as it is.
 */
function piecesOf(value: string, rich: boolean): { text: string; raw: string; tag: boolean }[] {
  if (!rich) return [{ text: value, raw: value, tag: false }];
  return value
    .split(/(<[^>]*>)/)
    .filter((raw) => raw !== "")
    .map((raw) =>
      raw.startsWith("<") ? { text: "", raw, tag: true } : { text: decode(raw), raw, tag: false },
    );
}

/** What `re` finds in `value`, with the text around each. */
export function findInValue(value: string, rich: boolean, re: RegExp): FoundText[] {
  const found: FoundText[] = [];
  for (const piece of piecesOf(value, rich)) {
    if (piece.tag) continue;
    for (const match of piece.text.matchAll(re)) {
      const start = match.index;
      const end = start + match[0].length;
      found.push({
        before: piece.text.slice(Math.max(0, start - CONTEXT), start),
        found: match[0],
        after: piece.text.slice(end, end + CONTEXT),
      });
    }
  }
  return found;
}

/**
 * `value` with what `re` finds replaced by `replacement`: every match, or only the match at
 * `only` (counted as {@link findInValue} lists them). The replacement is taken as it is, never as
 * a pattern (`$1` stays `$1`).
 */
export function replaceInValue(
  value: string,
  rich: boolean,
  re: RegExp,
  replacement: string,
  only?: number,
): { readonly value: string; readonly replaced: number } {
  let seen = 0;
  let replaced = 0;
  const pieces = piecesOf(value, rich).map((piece) => {
    if (piece.tag) return piece.raw;
    let changed = false;
    const text = piece.text.replace(re, (match) => {
      const index = seen++;
      if (only !== undefined && index !== only) return match;
      changed = true;
      replaced++;
      return replacement;
    });
    if (!changed) return piece.raw;
    return rich ? encode(text) : text;
  });
  return { value: pieces.join(""), replaced };
}

/** The value of a page or Site Settings field, and the most it may hold. */
function fieldOf(
  site: SiteDoc,
  spot: TextSpot,
): { value: unknown; max: number; required: boolean } {
  switch (spot.kind) {
    case "page": {
      const page = site.pages[spot.pageId];
      switch (spot.field) {
        case "title":
          return { value: page?.title, max: PAGE_TITLE_MAX, required: true };
        case "navLabel":
          return { value: page?.navLabel, max: MENU_LABEL_MAX, required: true };
        case "description":
          return { value: page?.settings.description, max: PAGE_DESCRIPTION_MAX, required: false };
      }
      break;
    }
    case "settings": {
      const { general, contact } = site.settings;
      switch (spot.field) {
        case "general.name":
          return { value: general.name, max: SITE_NAME_MAX, required: true };
        case "general.description":
          return { value: general.description, max: SITE_DESCRIPTION_MAX, required: false };
        case "contact.businessName":
          return { value: contact.businessName, max: BUSINESS_NAME_MAX, required: false };
        case "contact.address":
          return { value: contact.address, max: POSTAL_ADDRESS_MAX, required: false };
        case "contact.openingHoursNote":
          return { value: contact.openingHoursNote, max: OPENING_HOURS_NOTE_MAX, required: false };
      }
      break;
    }
    case "element":
      break;
  }
  return { value: undefined, max: 0, required: false };
}

/** Sets a page or Site Settings field of `draft`. */
function setField(draft: SiteDoc, spot: TextSpot, value: string): void {
  if (spot.kind === "page") {
    const page = draft.pages[spot.pageId];
    if (page === undefined) return;
    if (spot.field === "title") page.title = value;
    else if (spot.field === "navLabel") page.navLabel = value;
    else page.settings.description = value;
  } else if (spot.kind === "settings") {
    const { general, contact } = draft.settings;
    if (spot.field === "general.name") general.name = value;
    else if (spot.field === "general.description") general.description = value;
    else if (spot.field === "contact.businessName") contact.businessName = value;
    else if (spot.field === "contact.address") contact.address = value;
    else contact.openingHoursNote = value;
  }
}

/** The kinds of field that hold text the owner writes, and whether it's rich text. */
const TEXT_KINDS = { text: false, richtext: true } as const;

/**
 * Text fields a service reads rather than visitors, by component and field: a replacement there
 * would break what they do. Fields marked `sensitive` (payment links, form addresses) and values
 * that are web addresses (a video's, a map's) are left out too.
 */
const NOT_PROSE: ReadonlySet<string> = new Set(["Newsletter.emailName"]);

/** Whether `value` is a web address, an e-mail or phone link: never replaced as text. */
const isAddress = (value: string) => /^\s*(?:https?:|mailto:|tel:|www\.)/i.test(value);

/** Each text field of `node`, list items' included, with its value and whether it's rich. */
function* textFieldsOf(
  node: NodeDoc,
  library: ComponentLibrary,
): Generator<{
  readonly field: string;
  readonly item?: { readonly id: string; readonly field: string };
  readonly value: string;
  readonly rich: boolean;
}> {
  const fields = library.components[node.type]?.fields ?? {};
  for (const [name, def] of Object.entries(fields)) {
    const value = node.props[name];
    if (def.kind === "text" || def.kind === "richtext") {
      if (typeof value !== "string" || def.sensitive === true || isAddress(value)) continue;
      if (NOT_PROSE.has(`${node.type}.${name}`)) continue;
      // A field showing a Site Settings value: what it shows is found in Site Settings.
      if (bindingOf(node.props.bindings, name) !== undefined) continue;
      yield { field: name, value, rich: TEXT_KINDS[def.kind] };
    } else if (def.kind === "list" && Array.isArray(value)) {
      for (const item of value) {
        if (typeof item !== "object" || item === null) continue;
        const values = item as Record<string, unknown>;
        if (typeof values.id !== "string") continue;
        for (const [itemField, itemDef] of Object.entries(def.fields)) {
          const text = values[itemField];
          if (itemDef.kind === "text" && typeof text === "string") {
            yield {
              field: name,
              item: { id: values.id, field: itemField },
              value: text,
              rich: false,
            };
          }
        }
      }
    }
  }
}

/** Where a spot is listed: its page, the Header, the Footer, a shared section or Site Settings. */
export type SpotGroup = PageId | "header" | "footer" | "settings" | string;

export function groupOf(spot: TextSpot): SpotGroup {
  switch (spot.kind) {
    case "element":
      return spot.on;
    case "page":
      return spot.pageId;
    case "settings":
      return "settings";
  }
}

/**
 * Everything `options` finds in the site, in the list's order: each page in the Pages panel's
 * order (its own fields, then its elements), the Header, the Footer, each shared section once
 * (never its copies, so it's replaced once) and Site Settings. Hidden elements are searched: their
 * text is still the owner's.
 */
export function findInSite(
  site: SiteDoc,
  library: ComponentLibrary,
  options: FindOptions,
): SpotMatches[] {
  const re = matcher(options);
  if (re === undefined) return [];
  const byGroup = new Map<SpotGroup, SpotMatches[]>();
  const add = (spot: TextSpot, value: unknown, rich: boolean) => {
    if (typeof value !== "string") return;
    const matches = findInValue(value, rich, re);
    if (matches.length === 0) return;
    const group = groupOf(spot);
    byGroup.set(group, [...(byGroup.get(group) ?? []), { spot, matches }]);
  };
  for (const pageId of site.pageOrder) {
    for (const field of ["title", "navLabel", "description"] as const) {
      const spot: TextSpot = { kind: "page", pageId, field };
      add(spot, fieldOf(site, spot).value, false);
    }
  }
  eachElement(site, (node, on) => {
    for (const { field, item, value, rich } of textFieldsOf(node, library)) {
      const spot: TextSpot = {
        kind: "element",
        on,
        nodeId: node.props.id,
        type: node.type,
        field,
        ...(item === undefined ? {} : { item }),
      };
      add(spot, value, rich);
    }
  });
  for (const field of SETTINGS_FIELDS) {
    const spot: TextSpot = { kind: "settings", field };
    add(spot, fieldOf(site, spot).value, false);
  }
  const order: SpotGroup[] = [
    ...site.pageOrder,
    "header",
    "footer",
    ...Object.keys(site.sharedSections),
    "settings",
  ];
  return order.flatMap((group) => byGroup.get(group) ?? []);
}

/** The elements kept at `on` in `draft`: a page's, the Header's, the Footer's, a shared section. */
export function elementsAt(draft: SiteDoc, on: ElementPlace): NodeDoc[] {
  if (on === "header") return draft.layout.header;
  if (on === "footer") return draft.layout.footer;
  if (isPageIn(draft.pages, on)) return draft.pages[on]?.doc.content ?? [];
  const shared = Object.values(draft.sharedSections).find((entry) => entry.id === on);
  return shared === undefined ? [] : [shared.section];
}

/**
 * Replaces in `draft` what `options` finds, by `replacement`: in `spots` (from
 * {@link findInSite}), every match, or with `only`, the one match at that place in its spot.
 * A replacement that would empty a required field (a page's title, the site's name) or make one
 * longer than it may be is left out. Returns the spots changed.
 */
export function replaceInSite(
  draft: SiteDoc,
  library: ComponentLibrary,
  options: FindOptions,
  replacement: string,
  spots: readonly TextSpot[],
  only?: number,
): TextSpot[] {
  const re = matcher(options);
  if (re === undefined) return [];
  const changed: TextSpot[] = [];
  for (const spot of spots) {
    if (spot.kind === "element") {
      const node = findNode(elementsAt(draft, spot.on), (each) => each.props.id === spot.nodeId);
      if (node === undefined) continue;
      const field = [...textFieldsOf(node, library)].find(
        (each) =>
          each.field === spot.field &&
          each.item?.id === spot.item?.id &&
          each.item?.field === spot.item?.field,
      );
      if (field === undefined) continue;
      const next = replaceInValue(field.value, field.rich, re, replacement, only);
      if (next.replaced === 0 || next.value.length > MAX_TEXT_LENGTH) continue;
      const { item } = spot;
      if (item === undefined) {
        node.props[spot.field] = next.value;
      } else {
        const list = node.props[spot.field];
        if (!Array.isArray(list)) continue;
        const entry: unknown = list.find(
          (each: unknown) =>
            typeof each === "object" && each !== null && "id" in each && each.id === item.id,
        );
        if (typeof entry !== "object" || entry === null) continue;
        (entry as Record<string, unknown>)[item.field] = next.value;
      }
      changed.push(spot);
    } else {
      const { value, max, required } = fieldOf(draft, spot);
      if (typeof value !== "string") continue;
      const next = replaceInValue(value, false, re, replacement, only);
      if (next.replaced === 0 || next.value.length > max) continue;
      if (required && next.value.trim() === "") continue;
      setField(draft, spot, next.value);
      changed.push(spot);
    }
  }
  return changed;
}
