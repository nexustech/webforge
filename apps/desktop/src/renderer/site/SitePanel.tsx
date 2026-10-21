import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import { useSyncExternalStore } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import type { PanelRegistry } from "../shell/panels.js";
import { PagesPanel, type PagesPanelActions } from "./PagesPanel.js";
import {
  addPage,
  deletePage,
  duplicatePage,
  movePage,
  moveToFolder,
  renamePage,
  setHiddenFromNavigation,
  setHomePage,
} from "./page-actions.js";

/** The Pages panel's actions on `session`: each change is one undo step (F-ED-13). */
export function pagesPanelActions(session: EditorSession): PagesPanelActions {
  return {
    show: (pageId) => session.showPage(pageId),
    add: (name) => {
      addPage(session, name);
    },
    rename: (pageId, name) => renamePage(session, pageId, name),
    duplicate: (pageId) => {
      duplicatePage(session, pageId);
    },
    move: (pageId, direction) => movePage(session, pageId, direction),
    moveToFolder: (pageId, folder) => moveToFolder(session, pageId, folder),
    setHome: (pageId) => setHomePage(session, pageId),
    setHidden: (pageId, hidden) => setHiddenFromNavigation(session, pageId, hidden),
    remove: (pageId) => deletePage(session, pageId),
  };
}

/** Whether two versions of the site list the same pages the same way, whatever their content. */
function samePageList(a: SiteDoc, b: SiteDoc): boolean {
  if (a.pageOrder !== b.pageOrder || a.homePageId !== b.homePageId) {
    return false;
  }
  return a.pageOrder.every((id) => {
    const before = a.pages[id];
    const after = b.pages[id];
    return (
      before === after ||
      (before !== undefined &&
        after !== undefined &&
        before.title === after.title &&
        before.slug === after.slug &&
        before.folder === after.folder &&
        before.kind === after.kind &&
        before.settings === after.settings)
    );
  });
}

/**
 * Adds the Site panel to the right column's bottom (UI1), in Simple and Advanced mode. It holds
 * Pages for now; Media and Fonts join it later. Returns a function that removes it.
 */
export function registerSitePanel(panels: PanelRegistry, session: EditorSession): () => void {
  const actions = pagesPanelActions(session);
  const { document } = session.history;
  // The site as the panel last showed it, kept while only page content changes, so typing on the
  // canvas doesn't re-render the panel.
  let shownSite = document.getState();
  const pagesSite = () => {
    const site = document.getState();
    if (!samePageList(shownSite, site)) {
      shownSite = site;
    }
    return shownSite;
  };
  function SitePanel() {
    const site = useSyncExternalStore(document.subscribe, pagesSite, pagesSite);
    const shownPageId = useSyncExternalStore(
      session.ui.subscribe,
      () => session.ui.getState().pageId,
      () => session.ui.getState().pageId,
    );
    return <PagesPanel site={site} shownPageId={shownPageId} actions={actions} />;
  }
  return panels.register({
    id: "site",
    slot: "right.bottom",
    title: t("panels.site"),
    component: SitePanel,
  });
}
