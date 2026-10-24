import { t } from "@webforge/i18n";
import {
  anchorIdSchema,
  copiedAnchor,
  copyHolding,
  expandSharedCopies,
  isSharedCopy,
  type LinkValue,
  type NodeDoc,
  type PageId,
  pageAnchors,
  type SiteDoc,
  slugify,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { sameValue } from "../editor/same-value.js";

/**
 * A section a link can go to: a top-level element of a page, or the section a copy of a shared
 * section shows there (F-ED-23), under the id and anchor the copy gives it.
 */
type SectionTarget = {
  readonly nodeId: string;
  /** Its name in Layers or its shared section's, else its component's ("Opening times", "Hero"). */
  readonly label: string;
  /** Its anchor, if it has one already. */
  readonly anchorId: string | undefined;
};

/** A page a link can go to, with its sections. */
export type PageTarget = {
  readonly id: PageId;
  readonly title: string;
  readonly sections: readonly SectionTarget[];
};

const anchorOf = (node: NodeDoc) => {
  const anchor = node.props.advanced?.anchorId;
  return anchor === undefined || anchor === "" ? undefined : anchor;
};

/** The pages links can go to, in Pages panel order, each with its sections. */
export function linkTargets(site: SiteDoc, library: ComponentLibrary): PageTarget[] {
  return site.pageOrder.flatMap((id) => {
    const page = site.pages[id];
    if (page === undefined) return [];
    const sections = page.doc.content.flatMap((node) => {
      const shared = isSharedCopy(node)
        ? site.sharedSections[node.props.sharedSectionId]
        : undefined;
      return expandSharedCopies([node], site.sharedSections).map((shown) => ({
        nodeId: shown.props.id,
        label:
          shown.props.layerName?.trim() ||
          shared?.name ||
          (library.components[shown.type]?.label ?? shown.type),
        anchorId: anchorOf(shown),
      }));
    });
    return [{ id, title: page.title, sections }];
  });
}

/**
 * {@link linkTargets} for the documents of one open site (R9): worked out once per document, and
 * the same list (by reference) while the pages and sections it names read the same, so the link
 * fields showing it redraw only when one of those changes. Make one for each editor session.
 */
export function createLinkTargets(
  library: ComponentLibrary,
): (site: SiteDoc) => readonly PageTarget[] {
  const lists = new WeakMap<SiteDoc, readonly PageTarget[]>();
  let last: readonly PageTarget[] = [];
  return (site) => {
    const known = lists.get(site);
    if (known !== undefined) return known;
    const next = linkTargets(site, library);
    last = sameValue(next, last) ? last : next;
    lists.set(site, last);
    return last;
  };
}

/**
 * Whether an anchor given to section `nodeId` of page `pageId` would clash with one in use. A
 * section in a copy gets its anchor in its shared section, so every copy of it shows it, on every
 * page: as each copy gives it (`hours-2`), it must be free on each of those pages.
 */
function clashes(site: SiteDoc, pageId: PageId, nodeId: string): (anchor: string) => boolean {
  const { sharedSections: shared, layout } = site;
  const content = site.pages[pageId]?.doc.content ?? [];
  const copy = copyHolding(content, nodeId);
  if (copy === undefined) {
    const taken = pageAnchors(content, shared, layout);
    return (anchor) => taken.has(anchor);
  }
  const places = Object.values(site.pages).flatMap(({ doc }) => {
    const copies = doc.content
      .filter(isSharedCopy)
      .filter((node) => node.props.sharedSectionId === copy.props.sharedSectionId);
    const taken =
      copies.length === 0 ? new Set<string>() : pageAnchors(doc.content, shared, layout);
    return copies.map((node) => ({ taken, suffix: node.props.anchorSuffix }));
  });
  return (anchor) => places.some(({ taken, suffix }) => taken.has(copiedAnchor(anchor, suffix)));
}

/**
 * A new anchor for section `nodeId` of page `pageId`, linked to for the first time (F-ED-18): made
 * from its name ("Opening times" → `opening-times`), starting with a letter, and unique on its page
 * (on every page with a copy, for a section in a copy of a shared section).
 */
export function newAnchorFor(site: SiteDoc, pageId: PageId, nodeId: string, label: string): string {
  const base = slugify(label);
  const start = /^[a-z]/.test(base) ? base : `section-${base}`;
  const stem = start.slice(0, 56).replace(/-+$/, "");
  const taken = clashes(site, pageId, nodeId);
  let anchor = stem;
  for (let number = 2; taken(anchor) || !anchorIdSchema.safeParse(anchor).success; number++) {
    anchor = `${stem}-${number}`;
  }
  return anchor;
}

/**
 * Where a link to `target`, a section of page `pageId`, goes: its anchor, as the page shows it.
 * When it has none yet, also the anchor to give it (`given`); for a section in a copy, that goes
 * in the shared section, and the link to the anchor this copy gives it (`hours-2`).
 */
export function sectionAnchor(
  site: SiteDoc,
  pageId: PageId,
  target: SectionTarget,
): { readonly anchor: string; readonly given?: string } {
  if (target.anchorId !== undefined) {
    return { anchor: target.anchorId };
  }
  const given = newAnchorFor(site, pageId, target.nodeId, target.label);
  const copy = copyHolding(site.pages[pageId]?.doc.content ?? [], target.nodeId);
  return { anchor: copiedAnchor(given, copy?.props.anchorSuffix), given };
}

/**
 * A link in a few words, for its field: "About us", "About us › Opening times", "info@…", or a
 * document's file name ("Price list.pdf") from `media`.
 */
export function describeLink(
  link: LinkValue | undefined,
  targets: readonly PageTarget[],
  media: SiteDoc["media"] = {},
): string {
  if (link === undefined) {
    return t("link.none");
  }
  switch (link.kind) {
    case "page": {
      const page = targets.find((target) => target.id === link.pageId);
      if (page === undefined) return t("link.missingPage");
      const section = page.sections.find((target) => target.anchorId === link.anchor);
      return link.anchor === undefined
        ? page.title
        : t("link.pageSection", { page: page.title, section: section?.label ?? link.anchor });
    }
    case "email":
      return link.address;
    case "phone":
      return link.number;
    case "url":
      return link.href;
    case "file": {
      const document = Object.hasOwn(media, link.mediaId) ? media[link.mediaId] : undefined;
      return document === undefined ? t("link.missingFile") : document.fileName;
    }
  }
}
