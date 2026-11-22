import { copiedNodeId, designAt, type ElementPlace, isPageIn, pageWithCopy } from "@webforge/model";
import type { EditorSession } from "./editor-session.js";
import { postShowingDesign } from "./shared-layout.js";

/**
 * Shows element `nodeId`, kept `on` a page, the Header or Footer, a shared section or a collection's
 * design, selected on a page that shows it (#936): the Header's and Footer's on the page shown, a
 * shared section's in a copy of it, a design's on one of its posts. Whether it could: not a design
 * with no posts, nor a shared section with no copy. What Site Check, Find and Theme Studio's
 * colours outside the theme (TC-4) go to.
 */
export function showElement(
  session: Pick<EditorSession, "history" | "ui" | "showPage" | "select">,
  on: ElementPlace,
  nodeId: string,
): boolean {
  const site = session.history.document.getState();
  const design = designAt(site, on);
  if (on === "header" || on === "footer") {
    session.select(nodeId);
    return true;
  }
  if (isPageIn(site.pages, on)) {
    session.showPage(on);
    session.select(nodeId);
    return true;
  }
  if (design !== undefined) {
    const post = postShowingDesign(site, design.id, session.ui.getState().pageId);
    if (post === undefined) return false;
    session.showPage(post);
    session.select(nodeId);
    return true;
  }
  const holder = pageWithCopy(site, on, session.ui.getState().pageId);
  if (holder === undefined) return false;
  session.showPage(holder.pageId);
  session.select(copiedNodeId(holder.copyId, nodeId));
  return true;
}
