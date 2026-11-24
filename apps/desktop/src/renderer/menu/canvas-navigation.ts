import type { CanvasEngine } from "@webforge/engine";
import { sameJson } from "@webforge/model";
import type { NavItem, NavLink } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import { canvasNavigation, canvasPageLinks } from "../editor/site-navigation.js";

type Unsubscribe = () => void;

/**
 * Shows the site's navigation in the Header on the canvas (F-ED-17), made as the export makes it,
 * for the page shown. The canvas is drawn again only when the navigation changes (an edit of the
 * menu or of the pages, or another page shown), not on every keystroke. Not a document change, so
 * no undo step.
 */
export function connectCanvasNavigation(
  engine: Pick<CanvasEngine, "setNavigation">,
  session: Pick<EditorSession, "history" | "ui">,
): Unsubscribe {
  const { document } = session.history;
  let shown: { readonly items: readonly NavItem[]; readonly pages: readonly NavLink[] } | undefined;
  const show = () => {
    const site = document.getState();
    const { pageId } = session.ui.getState();
    const items = canvasNavigation(site, pageId);
    // And each page's link, which a Footer's Menu links can add (HF-8).
    const pages = canvasPageLinks(site, pageId);
    if (items === undefined || pages === undefined) return;
    const next = { items, pages };
    if (shown === undefined || !sameJson(next, shown)) {
      shown = next;
      engine.setNavigation(items, pages);
    }
  };
  show();
  const stopDocument = document.subscribe(show);
  const stopUi = session.ui.subscribe(show);
  return () => {
    stopDocument();
    stopUi();
  };
}
