import { z } from "zod";
import { validBindings } from "./bindings.js";
import { type NodeDoc, nodeDocSchema } from "./documents.js";
import {
  type CollectionId,
  collectionIdSchema,
  type MediaId,
  mediaIdSchema,
  type PageId,
} from "./ids.js";
import { findNode } from "./node-tree.js";
import { isDeviceName } from "./site-path.js";

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
export const COLLECTION_FIELD_KINDS = ["date", "text", "image", "tags"] as const;

/** The most tags an item can have. */
export const ITEM_TAGS_MAX = 20;

/** One of {@link COLLECTION_FIELD_KINDS}. */
export type CollectionFieldKind = (typeof COLLECTION_FIELD_KINDS)[number];

/** The longest name a collection can have ("Blog", "News"). */
export const COLLECTION_NAME_MAX = 100;
/** The longest label a collection's field can have ("Summary"). */
const COLLECTION_FIELD_LABEL_MAX = 100;
/** The most fields a collection can have. */
export const COLLECTION_FIELDS_MAX = 20;
/** The longest value an item's field can hold: a summary of a few sentences. */
export const ITEM_VALUE_MAX = 500;
/** The longest folder a collection's items can be in. */
const COLLECTION_FOLDER_MAX = 80;

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
const collectionFieldSchema = z.strictObject({
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

/**
 * What this module reads of a page: an item's collection, title and field values. Its own shape
 * rather than the site's page type, which is defined with the collections' schemas.
 */
type ItemPage = {
  readonly title: string;
  readonly collection?: CollectionId | undefined;
  readonly entry?: Readonly<Record<string, string>> | undefined;
};

/** What this module reads of a site: its collections. */
type WithCollections = { readonly collections: Readonly<Record<CollectionId, Collection>> };

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
  | { readonly kind: "image"; readonly mediaId: MediaId }
  /**
   * A post's tags (6.10b), typed separated by commas: each with the path of its page in its
   * collection's folder, `blog/tag/opening-times`, which the export writes.
   */
  | { readonly kind: "tags"; readonly tags: readonly ItemTag[] };

/** One of an item's tags, and where its page is. */
export type ItemTag = { readonly name: string; readonly path: string };

const isoDate = z.iso.date();

/**
 * The file name a tag's page has, from its name: `opening-times`. A name Windows keeps for a
 * device (`con`) gets `-tag` after it, so the export can always write it.
 */
export function tagSlug(name: string): string {
  // As a page's file name is made from its name (`slugify`, which the site document's module
  // uses, so it can't be imported here).
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, TAG_SLUG_MAX)
    .replace(/^-+|-+$/g, "");
  return slug !== "" && isDeviceName(slug) ? `${slug}-tag` : slug;
}

/** The longest file name a tag's page has. */
const TAG_SLUG_MAX = 60;

/**
 * The folders in a collection's own where the export writes its pages (6.10b): its list's later
 * pages (`blog/page/2`) and its tags' (`blog/tag/news`). No page may be in them.
 */
export const COLLECTION_PAGE_FOLDERS = ["page", "tag"] as const;

/** The path of the list of a collection whose folder is `folder`, page `n` (from 1). */
export const listPath = (folder: string, n = 1) =>
  n <= 1 ? `${folder}/index` : `${folder}/page/${n}`;

/** The path of the page of tag `name` in a collection whose folder is `folder`. */
export const tagPath = (folder: string, name: string) => `${folder}/tag/${tagSlug(name)}`;

/**
 * Tags typed separated by commas, `raw`, as their names: trimmed, without empty ones, each page
 * once (the first spelling wins), at most {@link ITEM_TAGS_MAX}.
 */
export function tagNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of raw.split(",")) {
    const name = part.trim().replace(/\s+/g, " ");
    const slug = name === "" ? "" : tagSlug(name);
    if (slug === "" || seen.has(slug) || names.length === ITEM_TAGS_MAX) continue;
    seen.add(slug);
    names.push(name);
  }
  return names;
}

/**
 * `raw`, a stored value, read as a field of `kind` of a collection whose folder is `folder`:
 * `undefined` when empty or it doesn't fit.
 */
function readValue(
  kind: CollectionFieldKind,
  raw: string | undefined,
  folder: string,
): ItemValue | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  switch (kind) {
    case "tags": {
      const names = tagNames(raw);
      return names.length === 0
        ? undefined
        : { kind: "tags", tags: names.map((name) => ({ name, path: tagPath(folder, name) })) };
    }
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
  page: Pick<ItemPage, "title" | "entry">,
  field: string,
): ItemValue | undefined {
  if (field === ITEM_TITLE_FIELD) return readValue("text", page.title, collection.folder);
  const def = collection.fields.find((each) => each.name === field);
  if (def === undefined || page.entry === undefined || !Object.hasOwn(page.entry, field)) {
    return undefined;
  }
  return readValue(def.kind, page.entry[field], collection.folder);
}

/** Every field of `page`, an item of `collection`, that has a value: its title first. */
export function itemValues(
  collection: Collection,
  page: Pick<ItemPage, "title" | "entry">,
): Record<string, ItemValue> {
  const values: Record<string, ItemValue> = {};
  for (const name of [ITEM_TITLE_FIELD, ...collection.fields.map((field) => field.name)]) {
    const value = itemValue(collection, page, name);
    if (value !== undefined) values[name] = value;
  }
  return values;
}

/**
 * Collection `id` of `site`, if it has one: its own entry only, so an id from a file such as
 * `constructor` never finds what every object has.
 */
export function collectionById(site: WithCollections, id: CollectionId): Collection | undefined {
  return Object.hasOwn(site.collections, id) ? site.collections[id] : undefined;
}

/** The collection `page` belongs to, if it is an item of one the site has. */
export function collectionOf(
  site: WithCollections,
  page: Pick<ItemPage, "collection">,
): Collection | undefined {
  return page.collection === undefined ? undefined : collectionById(site, page.collection);
}

/** An item's date, for ordering: its collection's first date field, or `""` without one. */
function itemDate(collection: Collection, page: ItemPage): string {
  const field = collection.fields.find((each) => each.kind === "date");
  const value = field === undefined ? undefined : itemValue(collection, page, field.name);
  return value?.kind === "date" ? value.date : "";
}

/**
 * The items of collection `id`, newest first by date, those without one last, otherwise in Pages
 * panel order. The one way to list a collection's items (ADR 0025, decision 8).
 */
export function collectionItems<Page extends ItemPage>(
  site: WithCollections & {
    readonly pages: Readonly<Record<PageId, Page>>;
    readonly pageOrder: readonly PageId[];
  },
  id: CollectionId,
): Page[] {
  const collection = collectionById(site, id);
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
export function freeCollectionFolder(site: WithCollections, wanted: string): string {
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
    { name: "tags", kind: "tags" },
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
