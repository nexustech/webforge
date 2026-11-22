import {
  copiedNodeId,
  designAt,
  type ElementPlace,
  isPageIn,
  type PageId,
  pageWithCopy,
} from "@webforge/model";
import type { EditorSession } from "./editor-session.js";
import { postShowingDesign } from "./shared-layout.js";

/** Where an element is shown: the page to show, if another, and the node to select there. */
type ElementSpot = { readonly pageId?: PageId; readonly nodeId: string };

/**
 * Where element `nodeId`, kept `on` a page, the Header or Footer, a shared section or a
 * collection's design, can be shown (#936): the Header's and Footer's on the page shown, a shared
 * section's in a copy of it, a design's on one of its posts. None for a design with no posts, nor
 * a shared section with no copy.
 */
function spotOf(
  session: Pick<EditorSession, "history" | "ui">,
  on: ElementPlace,
  nodeId: string,
): ElementSpot | undefined {
  const site = session.history.document.getState();
  if (on === "header" || on === "footer") return { nodeId };
  if (isPageIn(site.pages, on)) return { pageId: on, nodeId };
  const shown = session.ui.getState().pageId;
  const design = designAt(site, on);
  if (design !== undefined) {
    const post = postShowingDesign(site, design.id, shown);
    return post === undefined ? undefined : { pageId: post, nodeId };
  }
  const holder = pageWithCopy(site, on, shown);
  return holder === undefined
    ? undefined
    : { pageId: holder.pageId, nodeId: copiedNodeId(holder.copyId, nodeId) };
}

/**
 * Whether element `nodeId`, kept `on`, can be shown on a page: not one in a design with no posts,
 * nor in a shared section placed on none. What Theme Studio checks before it closes (TC-4).
 */
export function canShowElement(
  session: Pick<EditorSession, "history" | "ui">,
  on: ElementPlace,
  nodeId: string,
): boolean {
  return spotOf(session, on, nodeId) !== undefined;
}

/**
 * Shows element `nodeId`, kept `on` a page, the Header or Footer, a shared section or a
 * collection's design, selected on a page that shows it (#936). Whether it could
 * ({@link canShowElement}). What Site Check, Find and Theme Studio's colours outside the theme
 * (TC-4) go to.
 */
export function showElement(
  session: Pick<EditorSession, "history" | "ui" | "showPage" | "select">,
  on: ElementPlace,
  nodeId: string,
): boolean {
  const spot = spotOf(session, on, nodeId);
  if (spot === undefined) return false;
  if (spot.pageId !== undefined) session.showPage(spot.pageId);
  session.select(spot.nodeId);
  return true;
}
