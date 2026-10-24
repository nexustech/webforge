import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { siteDocArbitrary } from "../test/arbitraries.js";
import type { MediaId, PageId, SharedSectionId } from "./ids.js";
import type { MediaMeta } from "./media.js";
import { copiedNodeId, SHARED_COPY_TYPE } from "./shared-sections.js";
import { createSite, type SiteDoc } from "./site-doc.js";
import { siteSnapshotSchema } from "./site-snapshot.js";
import { DEFAULT_THEME } from "./theme.js";
import { siteToSnapshot } from "./to-snapshot.js";

const HASH = "c".repeat(64);

function bakery(): SiteDoc {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en-GB",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
    theme: { ...DEFAULT_THEME, preset: "cupcake" },
  });
  site.settings.general.description = "Fresh bread in Hightown";
  site.settings.contact.openingHours = [{ days: ["tue", "wed"], opens: "07:00", closes: "15:00" }];
  site.settings.forms.service = { kind: "formspree", formId: "xyzAbc12" };
  const cakes = "cakes" as PageId;
  site.pages[cakes] = {
    id: cakes,
    kind: "page",
    slug: "cakes",
    folder: "menu",
    title: "Our cakes",
    navLabel: "Cakes",
    settings: {
      description: "Birthday and wedding cakes",
      hideHeader: true,
      hideFooter: false,
      hideFromNavigation: false,
    },
    doc: { root: { props: {} }, content: [] },
  };
  site.pageOrder.splice(1, 0, cakes);
  const image = (id: string, hash: string): MediaMeta => ({
    id: id as MediaId,
    kind: "image",
    hash,
    name: id,
    fileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    width: 10,
    height: 10,
    alt: "",
  });
  const file: MediaMeta = {
    id: "menu" as MediaId,
    kind: "file",
    hash: "d".repeat(64),
    name: "menu",
    fileName: "menu.pdf",
    mimeType: "application/pdf",
  };
  // "gone" has no bytes in the blob map.
  site.media = Object.fromEntries(
    [image("hero", HASH), file, image("gone", "e".repeat(64))].map((item) => [item.id, item]),
  );
  return site;
}

describe("siteToSnapshot", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const site = bakery();
  const snapshot = siteToSnapshot(site, new Map([[HASH, bytes]]));

  it("makes a valid snapshot with the site's name, language, theme and layout", () => {
    expect(siteSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot).toMatchObject({
      name: "Rosa's Bakery",
      language: "en-GB",
      theme: { ...DEFAULT_THEME, preset: "cupcake" },
      layout: site.layout,
    });
  });

  it("lists pages in Pages panel order with their paths, labels and flags", () => {
    expect(snapshot.pages.map((page) => [page.path, page.title, page.navLabel])).toEqual([
      ["index", "Home", undefined],
      ["menu/cakes", "Our cakes", "Cakes"],
      ["404", "Page not found", undefined],
    ]);
    expect(snapshot.pages[1]).toMatchObject({
      id: "cakes",
      description: "Birthday and wedding cakes",
      hideHeader: true,
      hideFooter: false,
      hideFromNavigation: false,
    });
  });

  it("falls back to the site description and keeps the 'Page not found' page out of navigation", () => {
    expect(snapshot.pages[0]?.description).toBe("Fresh bread in Hightown");
    expect(snapshot.pages[2]?.hideFromNavigation).toBe(true);
  });

  it("includes images whose bytes are available, and no files", () => {
    expect(snapshot.media).toEqual([
      { id: "hero", name: "hero", mimeType: "image/jpeg", data: bytes, alt: expect.any(String) },
    ]);
  });

  it("carries the opening hours, for the Opening hours and contact section (2.8)", () => {
    expect(snapshot.openingHours).toEqual([
      { days: ["tue", "wed"], opens: "07:00", closes: "15:00" },
    ]);
  });

  it("carries the form service, for the Contact form (2.8)", () => {
    expect(snapshot.formService).toEqual({ kind: "formspree", formId: "xyzAbc12" });
  });

  it("carries the menu, for the Header's navigation (F-ED-17)", () => {
    const site = bakery();

    expect(siteToSnapshot(site, new Map()).menu).toBe(site.menu);
  });

  it("carries the Site Settings values elements can be bound to", () => {
    const site = bakery();
    site.settings.contact.phone = "+44 1234 567890";

    expect(siteToSnapshot(site, new Map()).settings).toEqual({
      "general.name": "Rosa's Bakery",
      "contact.phone": "+44 1234 567890",
    });
  });

  it("carries an image's alt text, focal point and crop for the export", () => {
    const site = bakery();
    const hero = site.media["hero" as MediaId];
    if (hero?.kind !== "image") throw new Error("no hero image");
    site.media[hero.id] = {
      ...hero,
      alt: "Fresh loaves",
      focal: { x: 0.3, y: 0.6 },
      crop: { x: 0, y: 0.1, width: 1, height: 0.8 },
    };

    expect(siteToSnapshot(site, new Map([[HASH, bytes]])).media).toEqual([
      {
        id: "hero",
        name: "hero",
        mimeType: "image/jpeg",
        data: bytes,
        alt: "Fresh loaves",
        focal: { x: 0.3, y: 0.6 },
        crop: { x: 0, y: 0.1, width: 1, height: 0.8 },
      },
    ]);
  });

  it("exports copies of shared sections inline, as their section (F-ED-23)", () => {
    const HOURS = "shared-hours" as SharedSectionId;
    const withCopy: SiteDoc = {
      ...site,
      sharedSections: {
        [HOURS]: {
          id: HOURS,
          name: "Opening hours",
          section: { type: "Section", props: { id: "s", content: [] } },
        },
      },
      pages: {
        ...site.pages,
        [site.homePageId]: {
          ...(site.pages[site.homePageId] as SiteDoc["pages"][PageId]),
          doc: {
            root: { props: {} },
            content: [{ type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } }],
          },
        },
      },
    };

    const [home] = siteToSnapshot(withCopy, new Map()).pages;

    expect(home?.doc.content).toEqual([
      { type: "Section", props: { id: copiedNodeId("c1", "s"), content: [] } },
    ]);
  });

  it("skips ids in the page order that have no page", () => {
    const broken = { ...site, pageOrder: [...site.pageOrder, "ghost" as PageId] };

    expect(siteToSnapshot(broken, new Map()).pages).toHaveLength(3);
  });

  it("gives every valid site a valid snapshot", () => {
    fc.assert(
      fc.property(siteDocArbitrary, (doc) => {
        const result = siteSnapshotSchema.safeParse(siteToSnapshot(doc, new Map()));
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  }, 30_000);
});
