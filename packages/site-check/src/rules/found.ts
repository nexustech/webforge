import {
  expandSharedCopies,
  isNodeDoc,
  type NodeDoc,
  type PageEntry,
  type PageId,
  pagePath,
  type SiteDoc,
} from "@webforge/model";
import type { CheckRule, ContactField, Finding } from "../types.js";

// Site Check's *Being found* group (3.17, SEO-7): what stops people finding the site, in plain
// words. None checks keywords, their density, the order of headings or a length (SEO-11): search
// engines document none of those as helping.

/** The site's description (Site Settings), what a page without its own inherits. */
const siteDescription = (site: SiteDoc) => (site.settings.general.description ?? "").trim();

/** Whether search engines may list the site at all (Site Settings › Search engines). */
const listed = (site: SiteDoc) => site.settings.search.allowIndexing;

/**
 * The pages search engines may list, in the site's order: none while the site is hidden from them,
 * and never the "Page not found" page or a page hidden from them (3.15).
 */
function listedPages(site: SiteDoc): readonly PageEntry[] {
  if (!listed(site)) return [];
  return site.pageOrder.flatMap((id) => {
    const page = site.pages[id];
    return page?.kind === "page" && page.settings.hideFromSearch !== true ? [page] : [];
  });
}

const pagePlace = (pageId: PageId) => ({ kind: "page", pageId }) as const;

/** `text` without its formatting, spaces or case: what makes two titles or descriptions the same. */
const comparable = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * The pages among `pages` whose `textOf` is the same as another's, each with the file of the first
 * other page it matches: what the panel names (`sameAs`). Empty texts are left to other rules.
 */
function samesIn(
  site: SiteDoc,
  pages: readonly PageEntry[],
  textOf: (page: PageEntry) => string,
): Finding[] {
  const byText = new Map<string, PageEntry[]>();
  for (const page of pages) {
    const text = comparable(textOf(page));
    if (text === "") continue;
    byText.set(text, [...(byText.get(text) ?? []), page]);
  }
  return pages.flatMap((page) => {
    const same = byText.get(comparable(textOf(page))) ?? [];
    const other = same.find((each) => each.id !== page.id);
    return other === undefined
      ? []
      : [
          {
            key: page.id,
            place: pagePlace(page.id),
            values: { sameAs: `${pagePath(other, site.homePageId)}.html` },
          },
        ];
  });
}

/**
 * The site is hidden from search engines (Site Settings › Search engines): nothing else in the
 * group applies while it is, so this says why. A tip: hiding it can be what the person wants.
 */
export const searchHiddenRule: CheckRule = {
  id: "searchHidden",
  level: "tip",
  group: "found",
  check: ({ site }) => (listed(site) ? [] : [{ key: "site", place: { kind: "search" } }]),
};

/**
 * A page without a description of its own: search engines then pick words from the page for its
 * result. The home page takes the site's description (1.18), so it has one while the site does.
 * Its *Fix* opens Page Settings on the page.
 */
export const pageDescriptionsRule: CheckRule = {
  id: "pageDescriptions",
  level: "should",
  group: "found",
  check: ({ site }) =>
    listedPages(site).flatMap((page) => {
      const own = page.settings.description?.trim() ?? "";
      const inherited = page.id === site.homePageId ? siteDescription(site) : "";
      return own === "" && inherited === "" ? [{ key: page.id, place: pagePlace(page.id) }] : [];
    }),
};

/**
 * Two pages with the same title, which search engines can't tell apart in their results. The home
 * page's title is the site's name (3.3), never the same as another's (*Page | Site name*).
 */
export const sameTitlesRule: CheckRule = {
  id: "sameTitles",
  level: "should",
  group: "found",
  check: ({ site }) =>
    samesIn(
      site,
      listedPages(site).filter((page) => page.id !== site.homePageId),
      (page) => page.title,
    ),
};

/**
 * Two pages with the same description, as the export writes them: a page's own, or the site's on
 * the home page. Pages without one are {@link pageDescriptionsRule}'s.
 */
export const sameDescriptionsRule: CheckRule = {
  id: "sameDescriptions",
  level: "should",
  group: "found",
  check: ({ site }) =>
    samesIn(site, listedPages(site), (page) => {
      const own = page.settings.description?.trim() ?? "";
      return own !== "" || page.id !== site.homePageId ? own : siteDescription(site);
    }),
};

/** `text` has words in it, formatting aside. */
const hasWords = (text: unknown) =>
  typeof text === "string" && text.replace(/<[^>]*>/g, "").trim() !== "";

/** `<h1>` start tags in Custom Code's HTML. */
const H1_TAG = /<h1[\s>]/gi;

/**
 * How many main headings (`<h1>`) `nodes` show, at any depth, hidden ones left out. The components
 * that write one: a large Heading (`HEADING_TAG` in site-components' `basic.tsx`), a Hero's title
 * (`SectionTitle size="page"`), and Custom Code's own HTML.
 */
function mainHeadings(nodes: readonly NodeDoc[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.props.hidden === true) continue;
    if (node.type === "Heading" && node.props.size === "large" && hasWords(node.props.text)) {
      count++;
    } else if (node.type === "Hero" && hasWords(node.props.title)) {
      count++;
    } else if (node.type === "CustomCode" && typeof node.props.code === "string") {
      count += node.props.code.match(H1_TAG)?.length ?? 0;
    }
    for (const value of Object.values(node.props)) {
      if (Array.isArray(value)) count += mainHeadings(value.filter(isNodeDoc));
    }
  }
  return count;
}

/**
 * A page with no main heading, or with several: search engines take the first as the page's
 * subject. Counted as the page shows: its Header and Footer unless it hides them, and its copies
 * of shared sections as they are. A tip.
 */
export const mainHeadingRule: CheckRule = {
  id: "mainHeading",
  level: "tip",
  group: "found",
  check: ({ site }) =>
    listedPages(site).flatMap((page) => {
      const count =
        (page.settings.hideHeader ? 0 : mainHeadings(site.layout.header)) +
        mainHeadings(expandSharedCopies(page.doc.content, site.sharedSections)) +
        (page.settings.hideFooter ? 0 : mainHeadings(site.layout.footer));
      return count === 1
        ? []
        : [{ key: page.id, place: pagePlace(page.id), values: { headings: count } }];
    }),
};

/** Whether the site is for a business, as Site Settings' business type says (SEO-1). */
const isBusiness = (site: SiteDoc) => {
  const type = site.settings.general.businessType;
  return type !== undefined && type !== "personal";
};

/**
 * The business's address, phone number or opening hours missing from Site Settings while its type
 * is set: what search engines show with a local business (3.15's structured data). One finding
 * each. A tip: not every business has all three.
 */
export const businessDetailsRule: CheckRule = {
  id: "businessDetails",
  level: "tip",
  group: "found",
  check: ({ site }) => {
    if (!listed(site) || !isBusiness(site)) return [];
    const { contact } = site.settings;
    const missing: Readonly<Record<ContactField, boolean>> = {
      address: (contact.address ?? "").trim() === "",
      phone: contact.phone === undefined,
      openingHours: contact.openingHours.length === 0,
    };
    return (Object.keys(missing) as ContactField[]).flatMap((field) =>
      missing[field] ? [{ key: field, place: { kind: "contact", field } as const }] : [],
    );
  },
};

/** Whether the site has its web address: it's on the web, or about to be. */
const hasAddress = (site: SiteDoc) => (site.settings.address.url ?? "") !== "";

/**
 * A one-time tip once the site has its web address: set up or check the business's Google Business
 * Profile, what ranks a local business most. Not for a personal site.
 */
export const businessProfileRule: CheckRule = {
  id: "businessProfile",
  level: "tip",
  group: "found",
  oneTime: true,
  check: ({ site }) =>
    listed(site) && hasAddress(site) && site.settings.general.businessType !== "personal"
      ? [{ key: "businessProfile", place: { kind: "guide", guide: "businessProfile" } }]
      : [],
};

/**
 * A one-time tip once the site has its web address: verify it in Google Search Console, with
 * the code Site Settings › Search engines writes (3.15). Not once that code is there.
 */
export const searchConsoleRule: CheckRule = {
  id: "searchConsole",
  level: "tip",
  group: "found",
  oneTime: true,
  check: ({ site }) =>
    listed(site) && hasAddress(site) && site.settings.search.verification?.google === undefined
      ? [{ key: "searchConsole", place: { kind: "guide", guide: "searchConsole" } }]
      : [],
};
