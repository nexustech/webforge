import {
  BUSINESS_KINDS,
  bindingOf,
  type Day,
  type NodeDoc,
  type SitePage,
  type SiteSnapshot,
} from "@webforge/model";
import { type ComponentLibrary, walkNodes } from "@webforge/site-components";
import { z } from "zod";
import { pageAddress, searchable, siteAddress } from "./site-files.js";

/** schema.org's names for the days the opening hours keep. */
const DAYS_OF_WEEK: Readonly<Record<Day, string>> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** A time as the opening hours keep it, `07:00`. */
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/**
 * The business's structured data as this export writes it (3.15, SEO-1), checked before it is:
 * schema.org's `LocalBusiness` with what Google's rich results read, and never a rating or a
 * review, which Google only takes from people.
 */
export const businessDataSchema = z.strictObject({
  "@context": z.literal("https://schema.org"),
  "@type": z.string().regex(/^[A-Z][A-Za-z]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.url().optional(),
  telephone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  openingHoursSpecification: z
    .array(
      z.strictObject({
        "@type": z.literal("OpeningHoursSpecification"),
        dayOfWeek: z.array(z.enum(Object.values(DAYS_OF_WEEK) as [string, ...string[]])).min(1),
        opens: time,
        closes: time,
      }),
    )
    .optional(),
  image: z.url().optional(),
  sameAs: z.array(z.url()).optional(),
  priceRange: z.string().optional(),
  geo: z
    .strictObject({
      "@type": z.literal("GeoCoordinates"),
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  menu: z.url().optional(),
});

/** The site's own structured data (3.15, SEO-1): its name and address, on the home page. */
export const websiteDataSchema = z.strictObject({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("WebSite"),
  name: z.string().min(1),
  url: z.url().optional(),
});

/** What a page shows of the business: its opening hours, its address. */
type Shown = { readonly hours: boolean; readonly address: boolean };

/**
 * What `nodes`, a page as exported with its Header and Footer, show of the business: the opening
 * hours where *Opening hours and contact* shows them, the address there or where a field is bound
 * to it (a Heading, the Footer, a Map). Only what a page shows goes in its structured data.
 */
function shownOn(nodes: readonly NodeDoc[], library: ComponentLibrary): Shown {
  let hours = false;
  let address = false;
  walkNodes(nodes, library, (node) => {
    if (node.type === "ContactDetails") {
      if (node.props.showHours !== false) hours = true;
      if (node.props.showContact !== false) address = true;
    }
    const bindings = node.props.bindings;
    if (
      bindings !== undefined &&
      Object.keys(bindings as object).some(
        (field) => bindingOf(bindings, field) === "contact.address",
      )
    ) {
      address = true;
    }
  });
  return { hours, address };
}

/**
 * The schema.org type the business is marked up as (3.15, SEO-1): its chosen kind when that is
 * one of its type's, else its type's first; `LocalBusiness` when its type is unknown, none for a
 * personal site, which is no business.
 */
function businessKindOf(site: SiteSnapshot): string | undefined {
  const type = site.business?.type;
  if (type === undefined) return "LocalBusiness";
  const kinds: readonly string[] = BUSINESS_KINDS[type];
  const kind = site.business?.kind;
  return kind !== undefined && kinds.includes(kind) ? kind : kinds[0];
}

/**
 * The first page search engines may show that has a section of type `type`, not hidden: the
 * contact page by its *Opening hours and contact*, whatever it is called ("Visit us", "Contact"),
 * and a restaurant's menu by its price list.
 */
function firstPageWith(site: SiteSnapshot, type: string): SitePage | undefined {
  return site.pages.find(
    (page) =>
      searchable(page) &&
      page.doc.content.some((node) => node.type === type && node.props.hidden !== true),
  );
}

/** Options of {@link structuredData}. */
type StructuredDataOptions = {
  readonly site: SiteSnapshot;
  readonly page: SitePage;
  /** What the page shows: its Header, content and Footer as exported. */
  readonly nodes: readonly NodeDoc[];
  readonly library: ComponentLibrary;
  /** The page's share image, as the export names it: the business's picture, with an address. */
  readonly shareImage: string | undefined;
};

/** `data` as a readable `<script type="application/ld+json">` (X4) that can't close itself early. */
const jsonLd = (data: object) =>
  `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replaceAll("</", "<\\/")}\n</script>`;

/**
 * The structured data the home page carries, and the contact page (3.15, SEO-1): the
 * business as schema.org's type for it (its name, description, address, telephone, opening
 * hours, picture, social profiles, price range and place on the map, and for a restaurant the
 * page with its prices as its menu), and the website by its name on the home page. Built from Site
 * Settings, nothing typed twice; the hours and address only where the page shows them. None on
 * other pages, and none for a page kept from search engines.
 */
export function structuredData({
  site,
  page,
  nodes,
  library,
  shareImage,
}: StructuredDataOptions): string[] {
  const home = page.path === "index";
  if ((!home && page.path !== firstPageWith(site, "ContactDetails")?.path) || !searchable(page)) {
    return [];
  }
  const address = siteAddress(site);
  const settings = site.settings ?? {};
  const tags: string[] = [];
  if (home) {
    tags.push(
      jsonLd(
        websiteDataSchema.parse({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: site.name,
          ...(address === undefined ? {} : { url: `${address}/` }),
        }),
      ),
    );
  }
  const kind = businessKindOf(site);
  if (kind === undefined) return tags;
  const shown = shownOn(nodes, library);
  const hours = shown.hours ? (site.openingHours ?? []) : [];
  const menuPage =
    kind === "Restaurant" && address !== undefined ? firstPageWith(site, "Pricing") : undefined;
  const sameAs = (site.socialProfiles ?? []).map((profile) => profile.url);
  const business = businessDataSchema.safeParse({
    "@context": "https://schema.org",
    "@type": kind,
    name: settings["contact.businessName"] ?? site.name,
    ...(site.search?.description === undefined ? {} : { description: site.search.description }),
    ...(address === undefined ? {} : { url: `${address}/` }),
    ...(settings["contact.phone"] === undefined ? {} : { telephone: settings["contact.phone"] }),
    ...(settings["contact.email"] === undefined ? {} : { email: settings["contact.email"] }),
    ...(shown.address && settings["contact.address"] !== undefined
      ? { address: settings["contact.address"] }
      : {}),
    ...(hours.length === 0
      ? {}
      : {
          openingHoursSpecification: hours.map((each) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: each.days.map((day) => DAYS_OF_WEEK[day]),
            opens: each.opens,
            closes: each.closes,
          })),
        }),
    // An absolute address: structured data is read away from the page.
    ...(address === undefined || shareImage === undefined
      ? {}
      : { image: `${address}/${shareImage}` }),
    ...(sameAs.length === 0 ? {} : { sameAs }),
    ...(site.business?.priceRange === undefined ? {} : { priceRange: site.business.priceRange }),
    ...(site.business?.geo === undefined
      ? {}
      : {
          geo: {
            "@type": "GeoCoordinates",
            latitude: site.business.geo.latitude,
            longitude: site.business.geo.longitude,
          },
        }),
    ...(menuPage === undefined || address === undefined
      ? {}
      : { menu: pageAddress(address, menuPage.path) }),
  });
  // A value the checks refuse leaves the business out rather than write something wrong.
  if (business.success) tags.push(jsonLd(business.data));
  return tags;
}
