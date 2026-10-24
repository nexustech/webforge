import { z } from "zod";
import type { PageId } from "./ids.js";
import type { SiteDoc } from "./site-doc.js";

/** The parts of a {@link SiteDoc} stored as one document each, under their own name. */
const PARTS = ["settings", "theme", "layout", "media", "code", "menu", "sharedSections"] as const;

/**
 * What a {@link SiteDocument} can hold: the one list of document kinds, shared by storage and the
 * IPC layer.
 */
export const SITE_DOCUMENT_KINDS = ["site", ...PARTS, "page"] as const;

/** What a {@link SiteDocument} holds. */
export type SiteDocumentKind = (typeof SITE_DOCUMENT_KINDS)[number];

/**
 * One document of a site as `.wforge` stores it. A site is split into documents so a save writes
 * only what changed: changing a heading rewrites one page, not the site (06, F6).
 */
export type SiteDocument = {
  /**
   * `site`, `settings`, `theme`, `layout`, `media`, `code`, `menu`, `sharedSections` or
   * `page:<PageId>`.
   */
  readonly id: string;
  readonly kind: SiteDocumentKind;
  readonly content: unknown;
};

const PAGE_PREFIX = "page:";

/**
 * A change to one of a site's documents, as the renderer sends it and storage commits it. Content
 * is checked separately, as part of the whole site the changes produce ({@link applySiteChanges}).
 */
export const siteDocumentChangeSchema = z.discriminatedUnion("type", [
  z
    .strictObject({
      type: z.literal("put"),
      id: z.string().min(1).max(100),
      kind: z.enum(SITE_DOCUMENT_KINDS),
      content: z.unknown(),
    })
    // Only documents a site is made of: `page:<id>` pages, every other part under its own name.
    // Anything else would be stored but never read back.
    .refine((change) =>
      change.kind === "page" ? change.id.startsWith(PAGE_PREFIX) : change.id === change.kind,
    ),
  z.strictObject({ type: z.literal("delete"), id: z.string().startsWith(PAGE_PREFIX) }),
]);

/** A change to the stored site: a document put under its id, or a page's document deleted. */
export type SiteDocumentChange = Readonly<z.infer<typeof siteDocumentChangeSchema>>;

/** The id of a page's document. */
export function pageDocumentId(id: PageId): string {
  return `${PAGE_PREFIX}${id}`;
}

/** The `site` document: the format version and the page order, which concern every page. */
function siteDocument(site: SiteDoc): SiteDocument {
  return {
    id: "site",
    kind: "site",
    content: {
      formatVersion: site.formatVersion,
      pageOrder: site.pageOrder,
      homePageId: site.homePageId,
    },
  };
}

/** Every document of `site`, e.g. to save a new or migrated site in full. */
export function siteDocuments(site: SiteDoc): SiteDocument[] {
  return [
    siteDocument(site),
    ...PARTS.map((part): SiteDocument => ({ id: part, kind: part, content: site[part] })),
    ...site.pageOrder.flatMap((id): SiteDocument[] => {
      const page = site.pages[id];
      return page === undefined ? [] : [{ id: pageDocumentId(id), kind: "page", content: page }];
    }),
  ];
}

/**
 * Puts stored documents back together into a site, without validating it: the result goes to
 * `migrateSite`, which migrates and validates. Unknown documents are ignored; missing ones leave
 * their part out, which validation then rejects.
 */
export function siteFromDocuments(
  documents: readonly { readonly id: string; readonly kind: string; readonly content: unknown }[],
): unknown {
  // No prototype: ids come from the file, and `page:__proto__` must not reach Object.prototype.
  const site: Record<string, unknown> = Object.create(null);
  const pages: Record<string, unknown> = Object.create(null);
  for (const { id, kind, content } of documents) {
    if (kind === "site" && id === "site" && typeof content === "object" && content !== null) {
      // Only its own keys: anything else in it must not override another part's document.
      const { formatVersion, pageOrder, homePageId } = content as Record<string, unknown>;
      Object.assign(site, { formatVersion, pageOrder, homePageId });
    } else if (kind === "page" && id.startsWith(PAGE_PREFIX)) {
      pages[id.slice(PAGE_PREFIX.length)] = content;
    } else if ((PARTS as readonly string[]).includes(kind) && id === kind) {
      site[kind] = content;
    }
  }
  site.pages = pages;
  return site;
}

/**
 * The site `changes` would leave behind (`site` is `undefined` for a new, still empty project),
 * unvalidated: what the main process checks with
 * `siteDocSchema` before it commits changes from the renderer, so the file never holds a broken
 * site (a page order naming a deleted page, a change of the wrong kind).
 */
export function applySiteChanges(
  site: SiteDoc | undefined,
  changes: readonly SiteDocumentChange[],
): unknown {
  const documents = new Map<string, SiteDocument>(
    (site === undefined ? [] : siteDocuments(site)).map((document) => [document.id, document]),
  );
  for (const change of changes) {
    if (change.type === "put") {
      documents.set(change.id, { id: change.id, kind: change.kind, content: change.content });
    } else {
      documents.delete(change.id);
    }
  }
  return siteFromDocuments([...documents.values()]);
}

/**
 * The documents that differ between two states of a site, found by reference: the history keeps
 * unchanged parts of the tree as the same objects (Immer structural sharing), so `!==` is exact and
 * cheap. Without `previous`, every document is new.
 */
export function changedDocuments(
  previous: SiteDoc | undefined,
  next: SiteDoc,
): SiteDocumentChange[] {
  if (previous === undefined) {
    return siteDocuments(next).map((document) => ({ type: "put", ...document }));
  }
  const changes: SiteDocumentChange[] = [];
  if (
    previous.formatVersion !== next.formatVersion ||
    previous.pageOrder !== next.pageOrder ||
    previous.homePageId !== next.homePageId
  ) {
    changes.push({ type: "put", ...siteDocument(next) });
  }
  for (const part of PARTS) {
    if (previous[part] !== next[part]) {
      changes.push({ type: "put", id: part, kind: part, content: next[part] });
    }
  }
  for (const [id, page] of Object.entries(next.pages)) {
    if (previous.pages[id as PageId] !== page) {
      changes.push({ type: "put", id: pageDocumentId(id as PageId), kind: "page", content: page });
    }
  }
  for (const id of Object.keys(previous.pages)) {
    if (!Object.hasOwn(next.pages, id)) {
      changes.push({ type: "delete", id: pageDocumentId(id as PageId) });
    }
  }
  return changes;
}
