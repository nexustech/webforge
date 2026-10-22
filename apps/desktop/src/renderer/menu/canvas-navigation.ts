import type { CanvasEngine } from "@webforge/engine";
import { pagePath, type SiteDoc } from "@webforge/model";
import { type NavigationPage, navigationFor } from "@webforge/pipeline/navigation";
import type { NavItem, NavLink } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";

type Unsubscribe = () => void;

/** The site's pages as the navigation sees them, in Pages panel order, as the export has them. */
function navigationPages(site: SiteDoc): NavigationPage[] {
  return site.pageOrder.flatMap((id) => {
    const page = site.pages[id];
    return page === undefined
      ? []
      : [
          {
            id: page.id,
            path: pagePath(page, site.homePageId),
            title: page.title,
            navLabel: page.navLabel,
            hideFromNavigation: page.settings.hideFromNavigation || page.kind === "not-found",
          },
        ];
  });
}

/** A link on the canvas goes nowhere: following it would load another document into the canvas. */
const inert = ({ newTab: _newTab, ...link }: NavLink): NavLink => ({ ...link, href: "#" });

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
  let shown = "";
  const show = () => {
    const site = document.getState();
    const pages = navigationPages(site);
    const page = pages.find((candidate) => candidate.id === session.ui.getState().pageId);
    if (page === undefined) return;
    const items = navigationFor({ pages, menu: site.menu }, page, "", () => undefined).map(
      (item): NavItem =>
        "children" in item ? { ...item, children: item.children.map(inert) } : inert(item),
    );
    const key = JSON.stringify(items);
    if (key !== shown) {
      shown = key;
      engine.setNavigation(items);
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
