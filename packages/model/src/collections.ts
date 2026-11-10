import { z } from "zod";
import { validBindings } from "./bindings.js";
import { type NodeDoc, nodeDocSchema } from "./documents.js";
import { type CollectionId, collectionIdSchema, type MediaId, mediaIdSchema } from "./ids.js";
import { findNode } from "./node-tree.js";
import type { PageEntry, SiteDoc } from "./site-doc.js";

/**
 * Collections (6.10a, ADR 0025, M2-1): a Blog, later a Portfolio or Events. An item is a page that
 * belongs to a collection; the collection holds what its items share: their fields and the design
 * drawn above and below every item's own content.
 */

/**
 * What a collection starts as: its fields, its design and its folder. A preset adds no code paths
 * (ADR 0025, decision 1), so the next one is another entry here.
 */
export const COLLECTION_PRESETS = ["blog"] as const;

/** One of {@link COLLECTION_PRESETS}. */
export type CollectionPreset = (typeof COLLECTION_PRESETS)[number];

/** The kinds of field an item can have beyond its title. */
export const COLLECTION_FIELD_KINDS = ["date", "text", "image"] as const;

/** One of {@link COLLECTION_FIELD_KINDS}. */
export type CollectionFieldKind = (typeof COLLECTION_FIELD_KINDS)[number];

/** The longest name a collection can have ("Blog", "News"). */
export const COLLECTION_NAME_MAX = 100;
/** The longest label a collection's field can have ("Summary"). */
export const COLLECTION_FIELD_LABEL_MAX = 100;
/** The most fields a collection can have. */
export const COLLECTION_FIELDS_MAX = 20;
/** The longest value an item's field can hold: a summary of a few sentences. */
export const ITEM_VALUE_MAX = 500;
/** The longest folder a collection's items can be in. */
export const COLLECTION_FOLDER_MAX = 80;

/** The field every item has, its page's title: a design's element can show it too. */
export const ITEM_TITLE_FIELD = "title";

/** A field's name, as bindings name it (`item.summary`): a letter, then letters and digits. */
const FIELD_NAME = /^[a-z][a-zA-Z0-9]{0,39}$/;

const fieldNameSchema = z.string().regex(FIELD_NAME);

/**
 * The folder a collection's items are in, one level: `blog`, so a post is `blog/spring-opening.html`.
 * Never `assets`, which holds the site's images, styles and scripts.
 */
export const collectionFolderSchema = z
  .string()
  .max(COLLECTION_FOLDER_MAX)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((folder) => folder !== "assets", { message: "The folder 'assets' is reserved" });

/** One of an item's own fields beyond its title: its name in bindings, its label and its kind. */
export const collectionFieldSchema = z.strictObject({
  name: fieldNameSchema.refine((name) => name !== ITEM_TITLE_FIELD, {
    message: "Every item has its title already",
  }),
  label: z.string().min(1).max(COLLECTION_FIELD_LABEL_MAX),
  kind: z.enum(COLLECTION_FIELD_KINDS),
});

/** See {@link collectionFieldSchema}. */
export type CollectionField = z.infer<typeof collectionFieldSchema>;

/**
 * A collection's design (ADR 0025, decision 4): the sections drawn above and below every item's
 * own content, their elements bound to the item's fields. Edited on the canvas, on any item.
 */
export type CollectionDesign = {
  readonly before: NodeDoc[];
  readonly after: NodeDoc[];
};

/** One of the site's collections: see the module's comment. */
export const collectionSchema = z.strictObject({
  id: collectionIdSchema,
  preset: z.enum(COLLECTION_PRESETS),
  /** What the person calls it: the Pages panel's group, undo labels. */
  name: z.string().min(1).max(COLLECTION_NAME_MAX),
  folder: collectionFolderSchema,
  fields: z
    .array(collectionFieldSchema)
    .max(COLLECTION_FIELDS_MAX)
    .refine((fields) => new Set(fields.map((field) => field.name)).size === fields.length, {
      message: "Each field's name once",
    }),
  design: z.strictObject({ before: z.array(nodeDocSchema), after: z.array(nodeDocSchema) }),
});

/** See {@link collectionSchema}. */
export type Collection = z.infer<typeof collectionSchema>;

/** The `collections` document: every collection of the site, by id. */
export const collectionsDocSchema = z.record(collectionIdSchema, collectionSchema);

/** See {@link collectionsDocSchema}. */
export type CollectionsDoc = z.infer<typeof collectionsDocSchema>;

/**
 * An item's field values by field name, as its page holds them (`entry`). Checked against its
 * collection's fields only when read ({@link itemValue}): a value that doesn't fit reads as empty,
 * as any invalid value does (ADR 0012, decision 2), and a field removed from the collection leaves
 * its values unread.
 */
export const itemEntrySchema = z.record(fieldNameSchema, z.string().max(ITEM_VALUE_MAX));

/** See {@link itemEntrySchema}. */
export type ItemEntry = z.infer<typeof itemEntrySchema>;

/** An item's field value, read for its kind: what a bound element shows. */
export type ItemValue =
  | { readonly kind: "text"; readonly text: string }
  /** `YYYY-MM-DD`, a real day. */
  | { readonly kind: "date"; readonly date: string }
  | { readonly kind: "image"; readonly mediaId: MediaId };

const isoDate = z.iso.date();

/** `raw`, a stored value, read as a field of `kind`: `undefined` when empty or it doesn't fit. */
function readValue(kind: CollectionFieldKind, raw: string | undefined): ItemValue | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  switch (kind) {
    case "text":
      return { kind: "text", text: raw };
    case "date":
      return isoDate.safeParse(raw).success ? { kind: "date", date: raw } : undefined;
    case "image": {
      const mediaId = mediaIdSchema.safeParse(raw);
      return mediaId.success ? { kind: "image", mediaId: mediaId.data } : undefined;
    }
  }
}

/**
 * The value of `field` on `page`, an item of `collection`: its title, or one of the collection's
 * fields. `undefined` while empty, when it doesn't fit its field's kind, or for a field the
 * collection doesn't have.
 */
export function itemValue(
  collection: Collection,
  page: Pick<PageEntry, "title" | "entry">,
  field: string,
): ItemValue | undefined {
  if (field === ITEM_TITLE_FIELD) return readValue("text", page.title);
  const def = collection.fields.find((each) => each.name === field);
  if (def === undefined || page.entry === undefined || !Object.hasOwn(page.entry, field)) {
    return undefined;
  }
  return readValue(def.kind, page.entry[field]);
}

/** Every field of `page`, an item of `collection`, that has a value: its title first. */
export function itemValues(
  collection: Collection,
  page: Pick<PageEntry, "title" | "entry">,
): Record<string, ItemValue> {
  const values: Record<string, ItemValue> = {};
  for (const name of [ITEM_TITLE_FIELD, ...collection.fields.map((field) => field.name)]) {
    const value = itemValue(collection, page, name);
    if (value !== undefined) values[name] = value;
  }
  return values;
}

/** The collection `page` belongs to, if it is an item of one the site has. */
export function collectionOf(site: Pick<SiteDoc, "collections">, page: PageEntry) {
  return page.collection === undefined ? undefined : site.collections[page.collection];
}

/** An item's date, for ordering: its collection's first date field, or `""` without one. */
function itemDate(collection: Collection, page: PageEntry): string {
  const field = collection.fields.find((each) => each.kind === "date");
  const value = field === undefined ? undefined : itemValue(collection, page, field.name);
  return value?.kind === "date" ? value.date : "";
}

/**
 * The items of collection `id`, newest first by date, those without one last, otherwise in Pages
 * panel order. The one way to list a collection's items (ADR 0025, decision 8).
 */
export function collectionItems(
  site: Pick<SiteDoc, "collections" | "pages" | "pageOrder">,
  id: CollectionId,
): PageEntry[] {
  const collection = site.collections[id];
  if (collection === undefined) return [];
  const items = site.pageOrder.flatMap((pageId) => {
    const page = site.pages[pageId];
    return page?.collection === id ? [{ page, date: itemDate(collection, page) }] : [];
  });
  // Array.prototype.sort is stable: items on the same day keep their Pages panel order.
  items.sort((a, b) =>
    a.date === b.date ? 0 : a.date === "" ? 1 : b.date === "" ? -1 : a.date < b.date ? 1 : -1,
  );
  return items.map((item) => item.page);
}

/** A folder for a new collection's items, from `wanted`, that no collection has yet: `blog-2`. */
export function freeCollectionFolder(site: Pick<SiteDoc, "collections">, wanted: string): string {
  const taken = new Set(Object.values(site.collections).map((each) => each.folder));
  if (!taken.has(wanted)) return wanted;
  let n = 2;
  while (taken.has(`${wanted}-${n}`)) n += 1;
  return `${wanted}-${n}`;
}

/** What {@link newCollection} takes: the preset, and the words and design the caller translates. */
export type NewCollectionOptions = {
  readonly id: CollectionId;
  readonly preset: CollectionPreset;
  readonly name: string;
  readonly folder: string;
  /** The preset's fields' labels, translated. */
  readonly labels: Readonly<Record<string, string>>;
  readonly design: CollectionDesign;
};

/** Each preset's fields beyond the title: the Blog's posts have a date, a summary and a picture. */
export const PRESET_FIELDS: Readonly<
  Record<CollectionPreset, readonly Omit<CollectionField, "label">[]>
> = {
  blog: [
    { name: "date", kind: "date" },
    { name: "summary", kind: "text" },
    { name: "picture", kind: "image" },
  ],
};

/** A new collection from its preset. */
export function newCollection(options: NewCollectionOptions): Collection {
  return {
    id: options.id,
    preset: options.preset,
    name: options.name,
    folder: options.folder,
    fields: PRESET_FIELDS[options.preset].map((field) => ({
      ...field,
      label: options.labels[field.name] ?? field.name,
    })),
    design: options.design,
  };
}

/**
 * The pictures of the item `page` is that its design's elements show (6.10a): what the export needs
 * beyond the pictures its elements place themselves. `page` is a snapshot's page, its design
 * already around its content.
 */
export function itemPicturesShown(page: {
  readonly item?: { readonly values: Readonly<Record<string, ItemValue>> } | undefined;
  readonly doc: { readonly content: readonly NodeDoc[] };
}): MediaId[] {
  const values = page.item?.values;
  if (values === undefined) return [];
  const shown = new Set<MediaId>();
  findNode(page.doc.content, (node) => {
    for (const field of Object.values(validBindings(node.props.bindings))) {
      const name = field.startsWith("item.") ? field.slice("item.".length) : undefined;
      const value = name !== undefined && Object.hasOwn(values, name) ? values[name] : undefined;
      if (value?.kind === "image") shown.add(value.mediaId);
    }
    // Every node, so none matches.
    return false;
  });
  return [...shown];
}
