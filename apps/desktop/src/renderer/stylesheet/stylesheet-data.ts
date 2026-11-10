import { anchorsIn, expandSharedCopies, type SiteDoc } from "@webforge/model";
import type { UsedSelectors } from "@webforge/site-check";
import type { EditorSession } from "../editor/editor-session.js";
import { siteSelectors } from "../editor/site-css.js";
import type { ClassCatalogue } from "../fields/index.js";
import { type CssSiteData, themeVariables } from "./css-language.js";

/** A class name a selector can have as it is: no variant (`md:`) or brackets to escape. */
const PLAIN_CLASS = /^-?[a-z_][\w-]*$/i;

/** What the Stylesheet's completion and lint read of the site (6.8). */
export type StylesheetFacts = {
  /** The classes and ids the site's pages have, for the lint's rules that match nothing. */
  readonly used: UsedSelectors;
  /** What completion offers. */
  readonly data: CssSiteData;
};

/**
 * What the Stylesheet's completion and lint read of `site`, with `catalogue`'s classes and
 * Tailwind's variables once it has come:
 * - the variables the site's styles define: the theme's first, then Tailwind's (`--text-xl`);
 * - the site's own classes first, then the catalogue's, plain names only, as `md:flex` or
 *   `[&_a]:underline` would need escaping in a selector;
 * - every anchor a link can go to: the pages', their shared sections' copies (`hours-2`), the
 *   Header's and the Footer's.
 */
export function stylesheetFacts(
  site: SiteDoc,
  session: Pick<EditorSession, "library">,
  catalogue: ClassCatalogue | undefined,
): StylesheetFacts {
  const used = siteSelectors(site, session);
  const anchors = anchorsIn([...site.layout.header, ...site.layout.footer]);
  for (const page of Object.values(site.pages)) {
    anchorsIn(expandSharedCopies(page.doc.content, site.sharedSections), anchors);
  }
  const plain = (name: string) => PLAIN_CLASS.test(name);
  return {
    used,
    data: {
      variables: [...new Set([...themeVariables(site.theme), ...(catalogue?.variables ?? [])])],
      classes: [
        ...new Set([
          ...[...used.classes].filter(plain).sort(),
          ...(catalogue?.classes ?? []).filter(plain),
        ]),
      ],
      ids: [...anchors].sort(),
    },
  };
}
