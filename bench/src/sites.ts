import {
  createSite,
  type NodeDoc,
  type PageId,
  pageId,
  type SiteDoc,
  type SitePage,
  type SiteSnapshot,
} from "@webforge/model";
import { largePage, sampleSite } from "@webforge/test-utils";

// The sites the benchmarks work on, as architecture §10 and ADR 0004 size them: pages of 20
// sections, and a site of 20 pages.

/** Sections on each large page: ADR 0004's "20-section page". */
export const SECTIONS = 20;

/** Pages in a large site: §10's "full export, 20 pages". */
export const PAGES = 20;

/**
 * A site of `pages` pages, each of {@link SECTIONS} sections (a heading, two texts and an FAQ of
 * four questions in each: 180 nodes a page), as the editor holds it.
 */
export function largeSite(pages = PAGES): SiteDoc {
  const created = createSite({
    name: "Large",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
    homeDoc: largePage({ sections: SECTIONS }),
  });
  const others = Array.from({ length: pages - 1 }, (_, index) => ({
    id: pageId(`page-${index}`),
    kind: "page" as const,
    slug: `page-${index}`,
    title: `Page ${index}`,
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
    doc: largePage({ sections: SECTIONS }),
  }));
  return {
    ...created,
    pages: { ...created.pages, ...Object.fromEntries(others.map((page) => [page.id, page])) },
    pageOrder: [...created.pageOrder, ...others.map((page) => page.id)],
  };
}

/** The home page of `site`; it has one. */
export function homeOf(site: SiteDoc): NonNullable<SiteDoc["pages"][PageId]> {
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("The site has no home page");
  return home;
}

/**
 * The sample site (`@webforge/test-utils`), its pages repeated to make {@link PAGES}: what an
 * export of a real small-business site builds, its photo on several pages, its forms, gallery,
 * carousel and FAQ.
 */
export function exportSite(pages = PAGES): SiteSnapshot {
  const sample = sampleSite();
  const copies: SitePage[] = [];
  for (let index = 0; copies.length < pages; index++) {
    const page = sample.pages[index % sample.pages.length];
    if (page === undefined) throw new Error("The sample site has no pages");
    const round = Math.floor(index / sample.pages.length);
    copies.push(
      round === 0
        ? page
        : { ...page, id: `${page.id}-${round}`, path: `copy-${round}-${page.path}` },
    );
  }
  return { ...sample, pages: copies };
}

/** `site` with the text of its first page's first paragraph changed to `text`. */
export function withFirstText(site: SiteSnapshot, text: string): SiteSnapshot {
  const [first, ...rest] = site.pages;
  if (first === undefined) throw new Error("The site has no pages");
  let done = false;
  const change = (node: NodeDoc): NodeDoc => {
    if (done) return node;
    if (node.type === "Text" && typeof node.props.text === "string") {
      done = true;
      return { ...node, props: { ...node.props, text: `<p>${text}</p>` } };
    }
    const content = node.props.content;
    return Array.isArray(content)
      ? { ...node, props: { ...node.props, content: (content as NodeDoc[]).map(change) } }
      : node;
  };
  const content = first.doc.content.map(change);
  if (!done) throw new Error("The first page has no text");
  return { ...site, pages: [{ ...first, doc: { ...first.doc, content } }, ...rest] };
}
