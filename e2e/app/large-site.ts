import {
  changedDocuments,
  createSite,
  type PageId,
  type SiteDoc,
  type SiteDocumentChange,
} from "@webforge/model";
import { countNodes, largePage } from "@webforge/test-utils";

/** A site whose home page has 225 nodes or more, and edits of it, one changed page each. */
export type LargeSiteEdits = {
  readonly site: SiteDoc;
  /** The changes of each edit: the home page's title, `Home 0`, `Home 1`… */
  readonly changeLists: readonly (readonly SiteDocumentChange[])[];
  /** The home page's title after the last edit. */
  readonly lastTitle: string;
};

/**
 * `count` edits of a site with a large home page, each renaming that page: what one autosave of a
 * typical edit commits (architecture §10, ADR 0003). For the autosave E2E and the commit timing in
 * `pnpm e2e:perf`.
 */
export function largeSiteEdits(count: number): LargeSiteEdits {
  const doc = largePage();
  if (countNodes(doc) < 225) throw new Error("The large page has fewer than 225 nodes");
  const site = createSite({
    name: "Large",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
    homeDoc: doc,
  });
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const edits: SiteDoc[] = Array.from({ length: count }, (_, index) => ({
    ...site,
    pages: { ...site.pages, [site.homePageId as PageId]: { ...home, title: `Home ${index}` } },
  }));
  return {
    site,
    changeLists: edits.map((edit, index) =>
      changedDocuments(index === 0 ? site : edits[index - 1], edit),
    ),
    lastTitle: `Home ${count - 1}`,
  };
}
