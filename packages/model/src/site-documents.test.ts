import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { siteDocArbitrary } from "../test/arbitraries.js";
import type { PageId } from "./ids.js";
import { migrateSite } from "./migrations.js";
import { createSite, type PageEntry, type SiteDoc, siteDocSchema } from "./site-doc.js";
import {
  applySiteChanges,
  changedDocuments,
  pageDocumentId,
  siteDocuments,
  siteFromDocuments,
} from "./site-documents.js";

const site = createSite({
  name: "Rosa's Bakery",
  language: "en",
  homeTitle: "Home",
  notFoundTitle: "Page not found",
});

describe("siteDocuments and siteFromDocuments", () => {
  it("split a site into one document per part and page, in a stable order", () => {
    const documents = siteDocuments(site);

    expect(documents.map((document) => document.id)).toEqual([
      "site",
      "settings",
      "theme",
      "layout",
      "media",
      "code",
      "menu",
      ...site.pageOrder.map(pageDocumentId),
    ]);
    expect(documents[0]?.content).toEqual({
      formatVersion: 1,
      pageOrder: site.pageOrder,
      homePageId: site.homePageId,
    });
  });

  it("put every valid site back together unchanged", () => {
    fc.assert(
      fc.property(siteDocArbitrary, (doc) => {
        const stored = JSON.parse(JSON.stringify(siteDocuments(doc)));
        expect(migrateSite(siteFromDocuments(stored))).toEqual(doc);
      }),
      { numRuns: 50 },
    );
  }, 30_000);

  it("ignores unknown documents and leaves missing parts out", () => {
    const documents = siteDocuments(site).filter((document) => document.id !== "menu");
    const raw = siteFromDocuments([
      ...documents,
      { id: "history", kind: "site", content: { formatVersion: 99 } },
      { id: "menu-old", kind: "menu", content: {} },
    ]) as Record<string, unknown>;

    expect(raw.formatVersion).toBe(1);
    expect("menu" in raw).toBe(false);
    expect(() => migrateSite(raw)).toThrow();
  });

  it("takes only the format version and page order from the site document", () => {
    const [siteDocument, settings, ...rest] = siteDocuments(site);
    const sneaky = {
      ...(siteDocument as (typeof rest)[number]),
      content: { ...(siteDocument?.content as object), settings: { general: {} } },
    };

    const raw = siteFromDocuments([...rest, settings, sneaky].filter((d) => d !== undefined)) as {
      settings: unknown;
    };

    expect(raw.settings).toEqual(site.settings);
  });

  it("keeps ids from the file away from Object.prototype", () => {
    const raw = siteFromDocuments([
      { id: "page:__proto__", kind: "page", content: { polluted: true } },
    ]) as { pages: Record<string, unknown> };

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(raw.pages)).toEqual(["__proto__"]);
  });
});

describe("changedDocuments", () => {
  it("puts every document of a new site", () => {
    expect(changedDocuments(undefined, site)).toHaveLength(siteDocuments(site).length);
  });

  it("finds nothing when nothing changed", () => {
    expect(changedDocuments(site, site)).toEqual([]);
  });

  it("puts only the parts and pages whose objects changed", () => {
    const home = site.pages[site.homePageId] as PageEntry;
    const next: SiteDoc = {
      ...site,
      theme: { name: "cupcake" },
      pages: { ...site.pages, [home.id]: { ...home, title: "Welcome" } },
    };

    expect(changedDocuments(site, next)).toEqual([
      { type: "put", id: "theme", kind: "theme", content: { name: "cupcake" } },
      { type: "put", id: pageDocumentId(home.id), kind: "page", content: next.pages[home.id] },
    ]);
  });

  it("deletes removed pages and rewrites the page order", () => {
    const about = { ...(site.pages[site.homePageId] as PageEntry), id: "about" as PageId };
    const withAbout: SiteDoc = {
      ...site,
      pages: { ...site.pages, [about.id]: about },
      pageOrder: [...site.pageOrder, about.id],
    };

    const changes = changedDocuments(withAbout, site);

    expect(changes).toEqual([
      {
        type: "put",
        id: "site",
        kind: "site",
        content: expect.objectContaining({ pageOrder: site.pageOrder }),
      },
      { type: "delete", id: "page:about" },
    ]);
  });
});

describe("applySiteChanges", () => {
  it("gives the site the changes describe, so applying a diff reproduces the new state", () => {
    const home = site.pages[site.homePageId] as PageEntry;
    const next: SiteDoc = {
      ...site,
      theme: { name: "cupcake" },
      pages: { ...site.pages, [home.id]: { ...home, title: "Welcome" } },
    };

    expect(siteDocSchema.parse(applySiteChanges(site, changedDocuments(site, next)))).toEqual(next);
  });

  it("builds a new site from the changes alone", () => {
    expect(
      siteDocSchema.parse(applySiteChanges(undefined, changedDocuments(undefined, site))),
    ).toEqual(site);
  });

  it("lets validation catch a change that breaks the site", () => {
    const deleteHome = applySiteChanges(site, [
      { type: "delete", id: pageDocumentId(site.homePageId) },
    ]);

    expect(siteDocSchema.safeParse(deleteHome).success).toBe(false);
  });
});
