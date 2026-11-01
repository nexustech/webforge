import { z } from "zod";
import { documentIssue } from "./documents.js";
import { type PageId, pageIdSchema } from "./ids.js";
import { sameJson } from "./same-json.js";
import {
  type PageEntry,
  pageEntrySchema,
  SITE_FIELD_SCHEMAS,
  SITE_PART_SCHEMAS,
  type SiteDoc,
  siteDocSchema,
  siteIssues,
} from "./site-doc.js";

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
 * is checked separately, with the site the changes produce ({@link validateSiteChanges}).
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
 * unvalidated: what `siteDocSchema` would check whole. The main process commits changes from the
 * renderer only once {@link validateSiteChanges} accepts them, which checks the same with only the
 * changed documents parsed, so the file never holds a broken site (a page order naming a deleted
 * page, a change of the wrong kind).
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

/** What {@link validateSiteChanges} gives: the site the changes leave, checked, or a refusal. */
export type SiteChangesResult =
  | { readonly success: true; readonly data: SiteDoc }
  | { readonly success: false };

type Part = (typeof PARTS)[number];

const isPart = (value: string): value is Part => (PARTS as readonly string[]).includes(value);

/**
 * The site `changes` leave `site` as, checked as `siteDocSchema` checks it, but parsing only the
 * changed documents (R13a). It never accepts what `siteDocSchema.safeParse(applySiteChanges(site,
 * changes))` refuses, and what both accept is the same site, its pages in the same order. The rest
 * of `site` passed before and is shared, unchanged; the checks across documents run on the result,
 * walking only the changed pages' and layout's element trees. Each changed document's unsafe keys
 * and depth are checked at the depth it has in the site, so a document refused as part of the
 * whole site is refused alone. The one difference: an object shared by reference between two
 * changed documents (structured clone keeps such references) is checked in each, where the whole
 * site's check visits it once, so it may be refused here and accepted there; only ever stricter.
 * A new, empty site (`site` undefined) is checked whole.
 */
export function validateSiteChanges(
  site: SiteDoc | undefined,
  changes: readonly SiteDocumentChange[],
): SiteChangesResult {
  if (site === undefined) {
    const parsed = siteDocSchema.safeParse(applySiteChanges(undefined, changes));
    return parsed.success ? { success: true, data: parsed.data } : { success: false };
  }
  // What each document ends up as: the last change to it wins, as in applySiteChanges.
  const latest = new Map<string, SiteDocumentChange>();
  for (const change of changes) {
    latest.set(change.id, change);
  }
  const pages: Record<string, PageEntry> = { ...site.pages };
  const parts: Partial<Record<Part, unknown>> = {};
  let fields: Partial<Pick<SiteDoc, keyof typeof SITE_FIELD_SCHEMAS>> = {};
  const changedPages = new Set<string>();
  for (const [id, change] of latest) {
    const isPage = id.startsWith(PAGE_PREFIX);
    const key = id.slice(PAGE_PREFIX.length);
    // A put of a kind its id doesn't take is ignored when the site is put back together, and so
    // is whatever was stored under that id: like a delete.
    const put =
      change.type === "put" &&
      (change.kind === "page" ? isPage : change.kind === id && (id === "site" || isPart(id)))
        ? change
        : undefined;
    if (put === undefined) {
      if (id === "site" || isPart(id)) {
        return { success: false };
      }
      if (isPage) {
        delete pages[key];
      }
      continue;
    }
    if (put.kind === "page") {
      // The pages record is 1 deep in the site; its keys are checked with it.
      if (documentIssue({ [key]: put.content }, 1) !== undefined) {
        return { success: false };
      }
      const pageId = pageIdSchema.safeParse(key);
      const page = pageEntrySchema.safeParse(put.content);
      if (!pageId.success || !page.success) {
        return { success: false };
      }
      pages[key] = page.data;
      changedPages.add(key);
    } else if (put.kind === "site") {
      if (typeof put.content !== "object" || put.content === null) {
        return { success: false };
      }
      // Only its own fields, as when the site is put back together.
      const content = put.content as Record<string, unknown>;
      const formatVersion = SITE_FIELD_SCHEMAS.formatVersion.safeParse(content.formatVersion);
      const pageOrder = SITE_FIELD_SCHEMAS.pageOrder.safeParse(content.pageOrder);
      const homePageId = SITE_FIELD_SCHEMAS.homePageId.safeParse(content.homePageId);
      if (
        documentIssue(content.pageOrder, 1) !== undefined ||
        !formatVersion.success ||
        !pageOrder.success ||
        !homePageId.success
      ) {
        return { success: false };
      }
      fields = {
        formatVersion: formatVersion.data,
        pageOrder: pageOrder.data,
        homePageId: homePageId.data,
      };
    } else {
      const part = put.kind;
      if (documentIssue(put.content, 1) !== undefined) {
        return { success: false };
      }
      const parsed = SITE_PART_SCHEMAS[part].safeParse(put.content);
      if (!parsed.success) {
        return { success: false };
      }
      parts[part] = parsed.data;
    }
  }
  // The pages in the order putting the site back together gives them: the stored order, a page
  // deleted and put again moving to the end, new pages after the rest (applySiteChanges' Map).
  const order = new Set(site.pageOrder);
  for (const change of changes) {
    if (!change.id.startsWith(PAGE_PREFIX)) continue;
    const key = change.id.slice(PAGE_PREFIX.length);
    if (change.type === "delete") order.delete(key as PageId);
    else order.add(key as PageId);
  }
  const ordered: Record<string, PageEntry> = {};
  for (const key of order) {
    const page = pages[key];
    if (page !== undefined) ordered[key] = page;
  }
  // In the site's own key order: the spreads keep it.
  const next = { ...site, ...parts, ...fields, pages: ordered } as SiteDoc;
  const issues = siteIssues(next, { pages: changedPages, layout: "layout" in parts });
  return issues.length === 0 ? { success: true, data: next } : { success: false };
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

/**
 * Makes `draft`, the site in a history step, into `target`, a version being restored (4.6),
 * document by document as `.wforge` stores them: only a document whose JSON differs is replaced,
 * with a copy. So the restore is one undo step, a page it changes is dated in that step as any
 * page's change is, and the documents it leaves alone keep their objects: autosave writes only
 * what it changed ({@link changedDocuments}).
 */
export function restoreSite(draft: SiteDoc, target: SiteDoc): void {
  // A copy, never the version's own objects: a site is JSON.
  const take = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  if (draft.formatVersion !== target.formatVersion) draft.formatVersion = target.formatVersion;
  if (!sameJson(draft.pageOrder, target.pageOrder)) draft.pageOrder = take(target.pageOrder);
  if (draft.homePageId !== target.homePageId) draft.homePageId = target.homePageId;
  for (const part of PARTS) {
    if (!sameJson(draft[part], target[part])) {
      (draft as Record<Part, unknown>)[part] = take(target[part]);
    }
  }
  for (const id of Object.keys(draft.pages) as PageId[]) {
    if (!Object.hasOwn(target.pages, id)) delete draft.pages[id];
  }
  for (const [id, page] of Object.entries(target.pages) as [PageId, PageEntry][]) {
    if (!sameJson(draft.pages[id], page)) draft.pages[id] = take(page);
  }
}
