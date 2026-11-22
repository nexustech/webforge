import { t } from "@webforge/i18n/components";
import {
  designAt,
  type ElementPlace,
  elementsAt,
  isPageIn,
  type NodeDoc,
  pageEntryOf,
  pagePath,
  type SiteDoc,
  sharedSectionOf,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { elementName } from "./labels.js";

// Where an element is, in a few words (Site Check's places, #1170; Theme Studio's colours outside
// the theme, TC-4): "Heading on About", "Logo in the Header", "Image in the design of 'Blog'".

/** `"header"` or `"footer"` when that is where `on` is. */
const layoutRegion = (on: ElementPlace): "header" | "footer" | undefined =>
  on === "header" ? "header" : on === "footer" ? "footer" : undefined;

/** The element `nodeId` kept `on`, at any depth, if it's there. */
function findNode(site: SiteDoc, on: ElementPlace, nodeId: string): NodeDoc | undefined {
  const roots = elementsAt(site, on);
  const search = (nodes: readonly unknown[]): NodeDoc | undefined => {
    for (const node of nodes) {
      if (typeof node !== "object" || node === null) continue;
      const each = node as NodeDoc;
      if (each.props.id === nodeId) return each;
      for (const value of Object.values(each.props)) {
        if (!Array.isArray(value)) continue;
        const found = search(value);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return search(roots);
}

/** The component type a Puck id starts with: `FaqItem` of `FaqItem-1777…`. */
const PUCK_ID = /^([A-Z][A-Za-z0-9]*)-/;

/**
 * An element `site` doesn't have, as Site Check names it: what it is, when its id says so, else
 * "An element"; never its id (#1170).
 */
function missingElement(nodeId: string, library: ComponentLibrary): string {
  const type = PUCK_ID.exec(nodeId)?.[1];
  const label = type === undefined ? undefined : library.components[type]?.label;
  return label ?? t("siteCheck.place.someElement");
}

/** A page as Site Check names it: its title, or its file while it has none. */
export function pageName(site: SiteDoc, pageId: string): string {
  const page = pageEntryOf(site.pages, pageId);
  if (page === undefined) return pageId;
  return page.title.trim() === ""
    ? t("siteCheck.place.untitled", { file: `${pagePath(page, site.homePageId)}.html` })
    : page.title;
}

/** How an element on a page is named: Site Check's "Heading on About". */
export const ON_PAGE = (element: string, page: string) =>
  t("siteCheck.place.page", { element, page });

/**
 * Where element `nodeId`, kept `on`, is: its name, and its page, the Header or Footer, a shared
 * section or a collection's design. `onPage` words an element on a page, for a caller with words
 * of its own (the code trust prompt).
 */
export function elementPlaceName(
  site: SiteDoc,
  library: ComponentLibrary,
  on: ElementPlace,
  nodeId: string,
  onPage: (element: string, page: string) => string = ON_PAGE,
): string {
  const node = findNode(site, on, nodeId);
  const element =
    node === undefined
      ? missingElement(nodeId, library)
      : elementName(node, library, site.sharedSections);
  const region = layoutRegion(on);
  if (region !== undefined) return t(`siteCheck.place.${region}`, { element });
  if (isPageIn(site.pages, on)) return onPage(element, pageName(site, on));
  // A Blog's design (#936), on every post: "Image in the design of 'Blog'".
  const design = designAt(site, on);
  if (design !== undefined) {
    return t("siteCheck.place.design", {
      element,
      name: t("history.namedItem", { name: design.name }),
    });
  }
  // A shared section without a name, or not in `site`, by what it is, never its id (#1170).
  const name = sharedSectionOf(site.sharedSections, on)?.name.trim() ?? "";
  return name === ""
    ? t("siteCheck.place.sharedUnnamed", { element })
    : t("siteCheck.place.shared", { element, name });
}
