import { t } from "@webforge/i18n";
import {
  anchorIdSchema,
  type LinkValue,
  type NodeDoc,
  type PageId,
  type SiteDoc,
  slugify,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";

/** A section a link can go to: a top-level element of a page. */
export type SectionTarget = {
  readonly nodeId: string;
  /** Its name in Layers, else its component's ("Opening times", "Hero"). */
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
    const sections = page.doc.content.map((node) => ({
      nodeId: node.props.id,
      label: node.props.layerName?.trim() || (library.components[node.type]?.label ?? node.type),
      anchorId: anchorOf(node),
    }));
    return [{ id, title: page.title, sections }];
  });
}

/** Every anchor in use on page `pageId`: its own elements' and the shared Header and Footer's. */
function anchorsOn(site: SiteDoc, pageId: PageId): Set<string> {
  const found = new Set<string>();
  const walk = (nodes: readonly unknown[]) => {
    for (const node of nodes as NodeDoc[]) {
      const anchor = anchorOf(node);
      if (anchor !== undefined) found.add(anchor);
      for (const value of Object.values(node.props)) {
        if (Array.isArray(value)) walk(value);
      }
    }
  };
  walk([...site.layout.header, ...(site.pages[pageId]?.doc.content ?? []), ...site.layout.footer]);
  return found;
}

/**
 * A new anchor for a section that is linked to for the first time (F-ED-18): made from its name
 * ("Opening times" → `opening-times`), starting with a letter, and unique on its page.
 */
export function newAnchorFor(site: SiteDoc, pageId: PageId, label: string): string {
  const base = slugify(label);
  const start = /^[a-z]/.test(base) ? base : `section-${base}`;
  const stem = start.slice(0, 56).replace(/-+$/, "");
  const taken = anchorsOn(site, pageId);
  let anchor = stem;
  for (let number = 2; taken.has(anchor) || !anchorIdSchema.safeParse(anchor).success; number++) {
    anchor = `${stem}-${number}`;
  }
  return anchor;
}

/** A link in a few words, for its field: "About us", "About us › Opening times", "info@…". */
export function describeLink(link: LinkValue | undefined, targets: readonly PageTarget[]): string {
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
    case "file":
      return t("link.file");
  }
}
