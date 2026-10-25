import { t } from "@webforge/i18n";
import { copiedNodeId, isNodeDoc, type NodeDoc, type PageId, type SiteDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { copySelection } from "../shared-sections/index.js";
import { sharedRegionOf, shownLayout } from "./shared-layout.js";

/** One step of the breadcrumb bar: the element the canvas shows under `id`, or the page (`null`). */
export type Crumb = { readonly id: string | null; readonly label: string };

/** The nodes from one of `nodes` down to the node `id`, in its slots; none if it isn't there. */
function pathTo(nodes: readonly NodeDoc[], id: string): NodeDoc[] | undefined {
  for (const node of nodes) {
    if (node.props.id === id) return [node];
    for (const value of Object.values(node.props)) {
      const inside = Array.isArray(value) ? pathTo(value.filter(isNodeDoc), id) : undefined;
      if (inside !== undefined) return [node, ...inside];
    }
  }
  return undefined;
}

/** An element's name, as Layers gives it: its own name if it has one, else its kind. */
function nameOf(node: NodeDoc, library: ComponentLibrary): string {
  const own = node.props.layerName;
  if (typeof own === "string" && own.trim() !== "") return own;
  return library.components[node.type]?.label ?? node.type;
}

/**
 * The breadcrumb bar's steps for the element `nodeId` the canvas shows on page `pageId` (1.30,
 * UX-9): the page, then each element around it, outermost first, down to it. In the shared Header
 * or Footer the region comes after the page; in a linked copy of a shared section, the copy (by
 * the section's name) and its elements, under the ids the canvas shows them by. Just the page
 * when nothing is selected or the element isn't there.
 */
export function selectionPath(
  site: SiteDoc,
  pageId: PageId,
  nodeId: string | null,
  library: ComponentLibrary,
): Crumb[] {
  const page = site.pages[pageId];
  // A page without a title yet is still a step to click.
  const title = page?.title.trim() ?? "";
  const crumbs: Crumb[] = [
    { id: null, label: title === "" ? t("canvas.breadcrumbs.page") : title },
  ];
  if (page === undefined || nodeId === null) return crumbs;
  const toCrumbs = (nodes: readonly NodeDoc[], shownId = (id: string) => id) =>
    nodes.map((node) => ({ id: shownId(node.props.id), label: nameOf(node, library) }));

  const layout = shownLayout(site, pageId);
  const region = sharedRegionOf(layout, nodeId);
  if (region !== undefined) {
    const path = pathTo(layout[region], nodeId) ?? [];
    const label = t(`canvas.sharedRegion.${region}`);
    return [...crumbs, { id: path[0]?.props.id ?? null, label }, ...toCrumbs(path.slice(1))];
  }

  const inCopy = copySelection(site, pageId, nodeId);
  if (inCopy !== undefined) {
    const { copy, shared, node } = inCopy;
    const shown = (id: string) => copiedNodeId(copy.props.id, id);
    const above = pathTo(page.doc.content, copy.props.id)?.slice(0, -1) ?? [];
    const inside = pathTo([shared.section], node.props.id) ?? [];
    return [
      ...crumbs,
      ...toCrumbs(above),
      { id: shown(shared.section.props.id), label: copy.props.layerName ?? shared.name },
      ...toCrumbs(inside.slice(1), shown),
    ];
  }

  return [...crumbs, ...toCrumbs(pathTo(page.doc.content, nodeId) ?? [])];
}
