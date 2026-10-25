import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { siteDocArbitrary } from "../test/arbitraries.js";
import type { PageId } from "./ids.js";
import { SHARED_COPY_TYPE } from "./shared-sections.js";
import { createSite, SITE_FORMAT_VERSION, type SiteDoc, siteDocSchema } from "./site-doc.js";
import {
  applySiteChanges,
  pageDocumentId,
  type SiteDocumentChange,
  siteDocuments,
  validateSiteChanges,
} from "./site-documents.js";

// validateSiteChanges (R13a): a save checks only the documents it changes, yet accepts exactly what
// checking the whole changed site would.

const site = siteDocSchema.parse(
  createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  }),
);

/** An object nested `levels` deep, as `{ a: { a: … } }`. */
function nested(levels: number): Record<string, unknown> {
  let value: Record<string, unknown> = {};
  for (let level = 1; level < levels; level++) value = { a: value };
  return value;
}

/** An object with `key` as its own key, which an object literal can't write for `__proto__`. */
const withKey = (key: string, value: unknown): Record<string, unknown> =>
  JSON.parse(`{${JSON.stringify(key)}: ${JSON.stringify(value)}}`);

/** A copy of a shared section, which may only be at the top of a page. */
const copy = { type: SHARED_COPY_TYPE, props: { id: "copy", sharedSectionId: "shared-hours" } };

/** A section holding a copy in its slot: refused anywhere. */
const nestedCopy = { type: "Section", props: { id: "outer", content: [copy] } };

/** A deep copy of a value that came from JSON. */
const copyOf = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** A page's document with `content`. */
const doc = (content: unknown[], props: Record<string, unknown> = {}) => ({
  root: { props },
  content,
});

/** A put of page `id` of `doc`: a copy of an existing page (the home page for a new id), edited. */
function pageChange(
  of: SiteDoc,
  id: string,
  edit: (page: Record<string, unknown>) => unknown,
): SiteDocumentChange {
  const page = of.pages[id as PageId] ?? of.pages[of.homePageId];
  return {
    type: "put",
    id: pageDocumentId(id as PageId),
    kind: "page",
    content: edit({ ...copyOf(page) }),
  };
}

const PARTS = ["settings", "theme", "layout", "media", "code", "menu", "sharedSections"] as const;

/**
 * Changes to `of`, valid and not: what the editor sends, and what a broken or hostile renderer
 * could. Each breaks one rule the whole-site schema checks, or none.
 */
function changeArbitrary(of: SiteDoc): fc.Arbitrary<SiteDocumentChange> {
  const anyPage = fc.constantFrom(...of.pageOrder, "new-page", "bad id!");
  const otherPage = fc.constantFrom(...of.pageOrder.filter((id) => id !== of.homePageId));
  const pageWith = (fields: (id: string) => Record<string, unknown>) =>
    anyPage.map((id) => pageChange(of, id, (page) => ({ ...page, id, ...fields(id) })));
  return fc.oneof(
    // Pages: edits, new pages, and pages breaking one rule each.
    fc
      .tuple(anyPage, fc.string({ maxLength: 10 }))
      .map(([id, title]) => pageChange(of, id, (page) => ({ ...page, id, title }))),
    fc
      .tuple(anyPage, fc.constantFrom("index", "404", "assets", "Bad Slug", "about"))
      .map(([id, slug]) => pageChange(of, id, (page) => ({ ...page, id, slug }))),
    otherPage.map((id) => pageChange(of, id, (page) => ({ ...page, folder: "assets/x" }))),
    pageWith(() => ({ id: "someone-else" })),
    pageWith(() => ({ kind: "not-found" })),
    pageWith(() => ({ doc: doc([nestedCopy]) })),
    pageWith(() => ({ doc: doc([copy]) })),
    fc
      .tuple(anyPage, fc.constantFrom("__proto__", "constructor", "prototype"))
      .map(([id, key]) =>
        pageChange(of, id, (page) => ({ ...page, id, doc: doc([], withKey(key, 1)) })),
      ),
    // Around the depth limit, which counts from the site: a value in a page's props is 6 deep
    // there, so 195 levels end at 200 (allowed) and 196 at 201 (refused).
    fc
      .tuple(anyPage, fc.integer({ min: 193, max: 199 }))
      .map(([id, levels]) =>
        pageChange(of, id, (page) => ({ ...page, id, doc: doc([], { deep: nested(levels) }) })),
      ),
    anyPage.map((id): SiteDocumentChange => ({ type: "delete", id: pageDocumentId(id as PageId) })),
    // The site document: page order, home page, format, and keys of its own that don't count.
    fc
      .record({
        order: fc.shuffledSubarray([...of.pageOrder, "new-page"]),
        home: fc.constantFrom(...of.pageOrder, "missing"),
        formatVersion: fc.constantFrom(SITE_FORMAT_VERSION, SITE_FORMAT_VERSION - 1),
        extra: fc.constantFrom(undefined, { note: 1 }, withKey("__proto__", 1)),
      })
      .map(
        ({ order, home, formatVersion, extra }): SiteDocumentChange => ({
          type: "put",
          id: "site",
          kind: "site",
          content: { formatVersion, pageOrder: order, homePageId: home, extra },
        }),
      ),
    fc.constantFrom<SiteDocumentChange>(
      { type: "put", id: "site", kind: "site", content: null },
      { type: "put", id: "site", kind: "site", content: [] },
    ),
    // The other parts: as they are, broken, or breaking a rule across documents.
    fc.constantFrom(...PARTS).map(
      (part): SiteDocumentChange => ({
        type: "put",
        id: part,
        kind: part,
        content: copyOf(of[part]),
      }),
    ),
    fc.constantFrom<SiteDocumentChange>(
      { type: "put", id: "settings", kind: "settings", content: {} },
      { type: "put", id: "code", kind: "code", content: withKey("__proto__", {}) },
      { type: "put", id: "theme", kind: "theme", content: nested(205) },
      { type: "put", id: "layout", kind: "layout", content: { header: [copy], footer: [] } },
      { type: "put", id: "layout", kind: "layout", content: { header: [], footer: [nestedCopy] } },
    ),
    fc.constant<SiteDocumentChange>({
      type: "put",
      id: "media",
      kind: "media",
      content: Object.fromEntries(
        Object.values(of.media).map((item) => [item.id, { ...item, name: "same" }]),
      ),
    }),
    fc.constant<SiteDocumentChange>({
      type: "put",
      id: "menu",
      kind: "menu",
      content: { ...of.menu, items: [...of.menu.items, ...of.menu.items] },
    }),
  );
}

describe("validateSiteChanges", () => {
  it("accepts exactly what checking the whole changed site accepts, with the same site", () => {
    fc.assert(
      fc.property(
        siteDocArbitrary
          .map((generated) => siteDocSchema.parse(generated))
          .chain((parsed) =>
            fc.tuple(fc.constant(parsed), fc.array(changeArbitrary(parsed), { maxLength: 4 })),
          ),
        ([parsed, changes]) => {
          const whole = siteDocSchema.safeParse(applySiteChanges(parsed, changes));
          const changed = validateSiteChanges(parsed, changes);

          expect(changed.success).toBe(whole.success);
          if (changed.success && whole.success) expect(changed.data).toEqual(whole.data);
        },
      ),
      { numRuns: 400 },
    );
  }, 60_000);

  it("refuses a page nested too deep counted from the site, though not counted from the page", () => {
    const home = site.pages[site.homePageId];
    // A value in the props is 6 deep in the site, so 197 levels end at 202, past the limit; in the
    // page's own document they end at 199, within it.
    const changes: SiteDocumentChange[] = [
      {
        type: "put",
        id: pageDocumentId(site.homePageId),
        kind: "page",
        content: { ...home, doc: doc([], { deep: nested(197) }) },
      },
    ];

    expect(siteDocSchema.safeParse(applySiteChanges(site, changes)).success).toBe(false);
    expect(validateSiteChanges(site, changes).success).toBe(false);
  });

  it("shares the parts and pages the changes leave as they are", () => {
    const home = site.pages[site.homePageId];
    const notFound = site.pageOrder.find((id) => id !== site.homePageId);
    const changes: SiteDocumentChange[] = [
      {
        type: "put",
        id: pageDocumentId(site.homePageId),
        kind: "page",
        content: { ...home, title: "Welcome" },
      },
    ];

    const result = validateSiteChanges(site, changes);

    expect(result.success).toBe(true);
    if (!result.success || notFound === undefined) return;
    expect(result.data.pages[site.homePageId]?.title).toBe("Welcome");
    expect(result.data.settings).toBe(site.settings);
    expect(result.data.pages[notFound]).toBe(site.pages[notFound]);
  });

  it("checks a new, empty site whole", () => {
    const changes = siteDocuments(site).map((document) => ({ type: "put" as const, ...document }));

    expect(validateSiteChanges(undefined, changes)).toEqual({ success: true, data: site });
    expect(validateSiteChanges(undefined, changes.slice(1)).success).toBe(false);
  });
});
