import { t } from "@webforge/i18n";
import type {
  CollectionDesign,
  CollectionId,
  LayoutDoc,
  NodeDoc,
  PageDoc,
  PageId,
  SiteDoc,
} from "@webforge/model";
import { collectionOf, findNode } from "@webforge/model";
import { updateField } from "./apply-patch.js";

/** The shared Header or Footer (F-ED-7, C5). */
export type SharedRegion = keyof LayoutDoc;

const REGIONS: readonly SharedRegion[] = ["header", "footer"];

/** The shared regions, as a page lists them: the Header first, the Footer last. */
export const SHARED_REGIONS: readonly SharedRegion[] = ["header", "footer"];

const HIDDEN_BY = { header: "hideHeader", footer: "hideFooter" } as const;

/** Whether page `pageId`'s settings hide `region` ("Hide the Header on this page"). */
export const regionHidden = (
  site: Pick<SiteDoc, "pages">,
  pageId: PageId,
  region: SharedRegion,
): boolean => site.pages[pageId]?.settings[HIDDEN_BY[region]] === true;

/** The page setting that hides `region` on a page. */
export const hiddenSetting = (region: SharedRegion) => HIDDEN_BY[region];

/** The layouts the canvas showed with a region hidden, by layout: the same object every time. */
const shownWithHidden = new WeakMap<LayoutDoc, Map<string, LayoutDoc>>();

/**
 * The shared Header and Footer as `pageId` shows them: without the ones its Page Settings hide
 * ("Hide the Footer on this page"). The site's own layout when it hides neither, and otherwise the
 * same object for the same layout and settings, so the canvas sees no change where there is none.
 */
export function shownLayout(site: SiteDoc, pageId: PageId): LayoutDoc {
  const settings = site.pages[pageId]?.settings;
  const hidden = REGIONS.filter((region) => settings?.[HIDDEN_BY[region]] === true);
  if (hidden.length === 0) {
    return site.layout;
  }
  const key = hidden.join(",");
  let byHidden = shownWithHidden.get(site.layout);
  if (byHidden === undefined) {
    byHidden = new Map();
    shownWithHidden.set(site.layout, byHidden);
  }
  let shown = byHidden.get(key);
  if (shown === undefined) {
    shown = { ...site.layout };
    for (const region of hidden) shown[region] = [];
    byHidden.set(key, shown);
  }
  return shown;
}

/** The layouts the canvas drew for an item, by layout and design: the same object every time. */
const withDesign = new WeakMap<LayoutDoc, WeakMap<CollectionDesign, LayoutDoc>>();

/**
 * What the canvas draws around page `pageId`'s own content (6.10a, ADR 0025): the Header and Footer
 * it shows ({@link shownLayout}), and for an item of a collection, a Blog's post, the collection's
 * design inside them: Header, design before, content, design after, Footer. The design is drawn
 * even where the page hides the Header or Footer. The same object for the same layout and design,
 * so the canvas sees no change where there is none.
 */
export function canvasLayout(site: SiteDoc, pageId: PageId): LayoutDoc {
  const shown = shownLayout(site, pageId);
  const page = site.pages[pageId];
  const design = page === undefined ? undefined : collectionOf(site, page)?.design;
  if (design === undefined || (design.before.length === 0 && design.after.length === 0)) {
    return shown;
  }
  let byDesign = withDesign.get(shown);
  if (byDesign === undefined) {
    byDesign = new WeakMap();
    withDesign.set(shown, byDesign);
  }
  let drawn = byDesign.get(design);
  if (drawn === undefined) {
    drawn = {
      header: [...shown.header, ...design.before],
      footer: [...design.after, ...shown.footer],
    };
    byDesign.set(design, drawn);
  }
  return drawn;
}

/**
 * Where a node the canvas draws around a page's own content is kept: the shared Header or Footer,
 * or a part of a collection's design.
 */
export type SharedHome =
  | SharedRegion
  | { readonly collection: CollectionId; readonly part: keyof CollectionDesign };

/** Where node `nodeId`, drawn around page `pageId`'s content ({@link canvasLayout}), is kept. */
export function sharedHomeOf(
  site: SiteDoc,
  pageId: PageId,
  nodeId: string,
): SharedHome | undefined {
  const page = site.pages[pageId];
  const collection = page === undefined ? undefined : collectionOf(site, page);
  if (collection !== undefined) {
    for (const part of ["before", "after"] as const) {
      if (findNode(collection.design[part], (node) => node.props.id === nodeId) !== undefined) {
        return { collection: collection.id, part };
      }
    }
  }
  return sharedRegionOf(shownLayout(site, pageId), nodeId);
}

/** The nodes kept at `home` in `site`, or in an Immer draft of it: what to change there. */
export function nodesAtHome(site: SiteDoc, home: SharedHome): NodeDoc[] {
  if (typeof home === "string") return site.layout[home];
  return site.collections[home.collection]?.design[home.part] ?? [];
}

/**
 * Writes `drawn`, the regions the canvas drew around page `pageId`'s content after an edit
 * ({@link canvasLayout}), back to where each node is kept, through `sync`: the Header's and
 * Footer's to the site's layout, the design's to its collection. A design's top-level sections
 * can't be added, moved or removed on the canvas (they are locked, as the Header's are), so the
 * design's are the ones it had; every other top-level node is the Header's or Footer's.
 */
export function syncCanvasLayout(
  draft: SiteDoc,
  site: SiteDoc,
  pageId: PageId,
  drawn: LayoutDoc,
  sync: (target: NodeDoc[], next: NodeDoc[]) => void,
): void {
  const shown = shownLayout(site, pageId);
  const page = site.pages[pageId];
  const collection = page === undefined ? undefined : collectionOf(site, page);
  const target = collection === undefined ? undefined : draft.collections[collection.id];
  const parts = { header: "before", footer: "after" } as const;
  for (const region of SHARED_REGIONS) {
    const part = parts[region];
    const ids = new Set(collection?.design[part].map((node) => node.props.id) ?? []);
    const own = drawn[region].filter((node) => !ids.has(node.props.id));
    // Not a region this page hides: the canvas showed none, so the edit can't be to it.
    if (shown[region].length > 0) sync(draft.layout[region], own);
    if (target !== undefined && ids.size > 0) {
      sync(
        target.design[part],
        drawn[region].filter((node) => ids.has(node.props.id)),
      );
    }
  }
}

/**
 * The undo label of an edit to an element of a collection's design (6.10a): "Edited the design of
 * 'Blog'", whichever element, as an edit inside a shared section is named by the section. Undefined
 * for an element that isn't in the design of page `pageId`'s collection.
 */
export function designLabel(
  site: SiteDoc,
  pageId: PageId,
  nodeId: string | null,
): string | undefined {
  const home = nodeId === null ? undefined : sharedHomeOf(site, pageId, nodeId);
  if (home === undefined || typeof home === "string") return undefined;
  const name = site.collections[home.collection]?.name ?? "";
  return t("blog.history.editedDesign", { name: t("history.namedItem", { name }) });
}

/** The region of `layout` that holds the node `nodeId`, at any depth, if any. */
export function sharedRegionOf(layout: LayoutDoc, nodeId: string): SharedRegion | undefined {
  return REGIONS.find(
    (region) => findNode(layout[region], (node) => node.props.id === nodeId) !== undefined,
  );
}

/** How many of the site's pages show `region`: every page whose settings don't hide it. */
export function pagesShowing(site: SiteDoc, region: SharedRegion): number {
  return Object.values(site.pages).filter((page) => !page.settings[HIDDEN_BY[region]]).length;
}

/** `nodes` as a page, for the helpers that walk a page's content. */
const asPage = (nodes: NodeDoc[]): PageDoc => ({ root: { props: {} }, content: nodes });

/**
 * Sets one field of the node `nodeId` kept at `home` in `draft`, an Immer draft of `site`, to what
 * `next` makes of its current value (see {@link updateField}). Returns false if it isn't there.
 */
export function updateSharedField(
  draft: SiteDoc,
  site: SiteDoc,
  home: SharedHome,
  nodeId: string,
  field: string,
  next: (current: unknown) => unknown,
): boolean {
  return updateField(
    asPage(nodesAtHome(draft, home)),
    asPage(nodesAtHome(site, home)),
    nodeId,
    field,
    next,
  );
}
