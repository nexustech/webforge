import type { LayoutDoc, NodeDoc, PageDoc, PageId, SiteDoc } from "@webforge/model";
import { findNode } from "@webforge/model";
import { updateField } from "./apply-patch.js";

/** The shared Header or Footer (F-ED-7, C5). */
export type SharedRegion = keyof LayoutDoc;

const REGIONS: readonly SharedRegion[] = ["header", "footer"];

/** The shared regions, as a page lists them: the Header first, the Footer last. */
export const SHARED_REGIONS: readonly SharedRegion[] = ["header", "footer"];

const HIDDEN_BY = { header: "hideHeader", footer: "hideFooter" } as const;

/** Whether page `pageId`'s settings hide `region` ("Hide the Header on this page"). */
export const regionHidden = (site: SiteDoc, pageId: PageId, region: SharedRegion): boolean =>
  site.pages[pageId]?.settings[HIDDEN_BY[region]] === true;

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
 * Sets one field of the node `nodeId` in `region` of `draft`, an Immer draft of `layout`, to what
 * `next` makes of its current value (see {@link updateField}). Returns false if it isn't there.
 */
export function updateSharedField(
  draft: LayoutDoc,
  layout: LayoutDoc,
  region: SharedRegion,
  nodeId: string,
  field: string,
  next: (current: unknown) => unknown,
): boolean {
  return updateField(asPage(draft[region]), asPage(layout[region]), nodeId, field, next);
}
