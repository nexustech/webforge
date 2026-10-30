import fc from "fast-check";
import type { MediaId, MenuItemId, PageId, SharedSectionId } from "../src/ids.js";
import type { LinkValue } from "../src/link.js";
import type { Looks } from "../src/look.js";
import type { MediaMeta } from "../src/media.js";
import type { MenuItem } from "../src/menu.js";
import type { SiteSettings } from "../src/settings.js";
import { type PageEntry, SITE_FORMAT_VERSION, type SiteDoc } from "../src/site-doc.js";
import { DEFAULT_THEME } from "../src/theme.js";

const segment = fc.stringMatching(/^[a-z0-9]{1,8}(?:-[a-z0-9]{1,8})?$/);
const slug = segment.filter((value) => !["index", "404", "assets"].includes(value));
const folder = fc
  .array(segment, { minLength: 1, maxLength: 2 })
  .map((parts) => parts.join("/"))
  .filter((value) => !value.startsWith("assets"));
const id = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9_-]{0,20}$/);
const anyText = (maxLength: number) => fc.string({ unit: "grapheme", maxLength });
const hash = fc.stringMatching(/^[0-9a-f]{64}$/);

const link = (pageIds: readonly string[]): fc.Arbitrary<LinkValue> =>
  fc.oneof(
    fc.record({ kind: fc.constant("page" as const), pageId: fc.constantFrom(...pageIds) }),
    fc.record({ kind: fc.constant("url" as const), href: fc.constant("https://example.com/x") }),
    fc.record(
      { kind: fc.constant("phone" as const), number: fc.constant("+44 1234 567890") },
      { requiredKeys: ["kind", "number"] },
    ),
  ) as fc.Arbitrary<LinkValue>;

/**
 * The theme's looks by kind (3.12, CT-1), or none: values set once or per device, theme colours
 * with a shade and opacity, a toggle and a hover row.
 */
const looks: fc.Arbitrary<Looks | undefined> = fc.option(
  fc.dictionary(
    fc.constantFrom("Button", "Heading", "Hero", "CallToAction"),
    fc.record(
      {
        lookCorners: fc.constantFrom("none", "full"),
        lookShadow: fc.oneof(
          fc.constantFrom("default", "large"),
          fc.constant({ $responsive: { desktop: "medium", mobile: "none" } }),
        ),
        lookBackground: fc.constantFrom("primary", "accent-300/80"),
        lookItalic: fc.boolean(),
        overlay: fc.constantFrom("20", "80"),
        hover: fc.constantFrom("lift", "none"),
      },
      { requiredKeys: [] },
    ),
    { maxKeys: 3 },
  ),
  { nil: undefined },
);

const settings: fc.Arbitrary<SiteSettings> = fc.record({
  general: fc.record(
    {
      name: anyText(40).filter((name) => name.length > 0),
      description: anyText(60),
      language: fc.constantFrom("en", "en-GB", "de", "fr-CA"),
    },
    { requiredKeys: ["name", "language"] },
  ),
  address: fc.record({ url: fc.constant("https://www.example.com") }, { requiredKeys: [] }),
  social: fc.record({
    profiles: fc.array(
      fc.record({
        network: fc.constantFrom("instagram", "facebook", "custom" as const),
        url: fc.constant("https://instagram.com/rosa"),
      }),
      { maxLength: 3 },
    ),
  }),
  contact: fc.record(
    {
      businessName: anyText(40),
      phone: fc.constant("01234 567890"),
      openingHours: fc.array(
        fc.record({
          days: fc.subarray(["mon", "tue", "wed"] as const, { minLength: 1 }),
          opens: fc.constant("07:00"),
          closes: fc.constant("15:30"),
        }),
        { maxLength: 2 },
      ),
    },
    { requiredKeys: ["openingHours"] },
  ),
  search: fc.record(
    { allowIndexing: fc.boolean(), includeSitemap: fc.boolean(), readableByAi: fc.boolean() },
    { requiredKeys: ["allowIndexing", "includeSitemap"] },
  ),
  analytics: fc.record(
    { consentBanner: fc.boolean(), consentMessage: fc.string({ maxLength: 40 }) },
    { requiredKeys: ["consentBanner"] },
  ),
  forms: fc.constant({}),
  publish: fc.constant({ destinations: [] }),
  allowedExternalUrls: fc.array(fc.constant("https://fonts.example.com"), { maxLength: 1 }),
}) as fc.Arbitrary<SiteSettings>;

const pageEntry = (pageId: string, kind: PageEntry["kind"], pageSlug: string, inFolder?: string) =>
  fc
    .record(
      {
        title: anyText(40),
        navLabel: anyText(20).filter((label) => label.length > 0),
        description: anyText(60),
        hideHeader: fc.boolean(),
        hideFooter: fc.boolean(),
        hideFromNavigation: fc.boolean(),
        hideFromSearch: fc.boolean(),
        updated: fc
          .date({ min: new Date("2026-01-01"), max: new Date("2030-12-31"), noInvalidDate: true })
          .map((day) => day.toISOString().slice(0, 10)),
        text: anyText(80),
      },
      { requiredKeys: ["title", "hideHeader", "hideFooter", "hideFromNavigation", "text"] },
    )
    .map(({ title, navLabel, description, text, updated, ...flags }): PageEntry => {
      const entry: PageEntry = {
        id: pageId as PageId,
        kind,
        slug: pageSlug,
        title,
        settings: { ...flags, ...(description === undefined ? {} : { description }) },
        doc: {
          root: { props: {} },
          content: [{ type: "Text", props: { id: `${pageId}-text`, text } }],
        },
      };
      if (navLabel !== undefined) entry.navLabel = navLabel;
      // The day it last changed (3.15), as an edit dates a page.
      if (updated !== undefined) entry.updated = updated;
      if (inFolder !== undefined) entry.folder = inFolder;
      return entry;
    });

const imageMeta = (mediaId: string, name: string): fc.Arbitrary<MediaMeta> =>
  fc
    .record(
      {
        hash,
        width: fc.integer({ min: 1, max: 5000 }),
        height: fc.integer({ min: 1, max: 5000 }),
        alt: anyText(40),
        focal: fc.record({ x: fc.double({ min: 0, max: 1, noNaN: true }), y: fc.constant(0.5) }),
      },
      { requiredKeys: ["hash", "width", "height", "alt"] },
    )
    .map((fields) => ({
      ...fields,
      id: mediaId as MediaId,
      kind: "image" as const,
      name,
      fileName: `${name}.jpg`,
      mimeType: "image/jpeg" as const,
    }));

/** Valid sites with up to 6 pages (some in folders), media and a custom menu. */
export const siteDocArbitrary: fc.Arbitrary<SiteDoc> = fc
  .record({
    pageIds: fc.uniqueArray(id, { minLength: 2, maxLength: 6 }),
    slugs: fc.uniqueArray(slug, { minLength: 6, maxLength: 6 }),
    folders: fc.array(fc.option(folder, { nil: undefined }), { minLength: 6, maxLength: 6 }),
    mediaIds: fc.uniqueArray(id, { maxLength: 3 }),
    mediaNames: fc.uniqueArray(segment, { minLength: 3, maxLength: 3 }),
    menuIds: fc.uniqueArray(id, { minLength: 4, maxLength: 4 }),
  })
  .chain(({ pageIds, slugs, folders, mediaIds, mediaNames, menuIds }) => {
    const [homeId, notFoundId, ...others] = pageIds as [string, string, ...string[]];
    const pages = fc.tuple(
      pageEntry(homeId, "page", slugs[0] ?? "home"),
      pageEntry(notFoundId, "not-found", slugs[1] ?? "missing"),
      // Distinct slugs, and a folder only on the page itself, keep every path unique.
      ...others.map((pageId, index) =>
        pageEntry(pageId, "page", slugs[index + 2] ?? "page", folders[index + 2]),
      ),
    );
    const media = fc.tuple(
      ...mediaIds.map((mediaId, index) => imageMeta(mediaId, mediaNames[index] ?? "image")),
    );
    const menu = fc.record({
      follows: fc.constantFrom("pages", "custom" as const),
      items: fc.tuple(
        fc.record({
          id: fc.constant(menuIds[0] as MenuItemId),
          kind: fc.constant("page" as const),
          pageId: fc.constant(homeId as PageId),
          hidden: fc.boolean(),
        }),
        fc.record({
          id: fc.constant(menuIds[1] as MenuItemId),
          kind: fc.constant("group" as const),
          label: fc.constant("More"),
          hidden: fc.boolean(),
          children: fc.tuple(
            fc.record({
              id: fc.constant(menuIds[2] as MenuItemId),
              kind: fc.constant("button" as const),
              label: fc.constant("Book now"),
              link: link(pageIds),
              hidden: fc.boolean(),
            }),
          ),
        }),
      ),
    }) as fc.Arbitrary<{ follows: "pages" | "custom"; items: MenuItem[] }>;
    return fc
      .record({
        pages,
        media,
        menu,
        settings,
        looks,
        order: fc.shuffledSubarray(pageIds, {
          minLength: pageIds.length,
        }),
      })
      .map(
        ({
          pages: entries,
          media: items,
          menu: menuDoc,
          settings: siteSettings,
          looks: themeLooks,
          order,
        }): SiteDoc => ({
          formatVersion: SITE_FORMAT_VERSION,
          settings: siteSettings,
          theme: {
            ...DEFAULT_THEME,
            preset: "cupcake",
            ...(themeLooks === undefined ? {} : { looks: themeLooks }),
          },
          layout: { header: [], footer: [{ type: "Footer", props: { id: "footer", text: "©" } }] },
          pages: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
          pageOrder: order as PageId[],
          homePageId: homeId as PageId,
          media: Object.fromEntries(items.map((item) => [item.id, item])),
          code: { css: "", js: "", head: "", bodyEnd: "" },
          menu: menuDoc,
          sharedSections: {
            ["shared-hours" as SharedSectionId]: {
              id: "shared-hours" as SharedSectionId,
              name: "Opening hours",
              section: {
                type: "Section",
                props: { id: "hours", contentWidth: "medium", content: [] },
              },
            },
          },
        }),
      );
  });
