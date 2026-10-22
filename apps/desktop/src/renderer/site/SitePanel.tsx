import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import { useSyncExternalStore } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { linkTargets } from "../links/link-targets.js";
import { MenuPanel, type MenuPanelActions } from "../menu/MenuPanel.js";
import {
  addMenuItem,
  editMenuLink,
  followPages,
  moveMenuItem,
  removeMenuItem,
  renameMenuItem,
  setMenuItemHidden,
} from "../menu/menu-actions.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PanelRegistry } from "../shell/panels.js";
import { PagesPanel, type PagesPanelActions } from "./PagesPanel.js";
import {
  addPage,
  changePageSettings,
  deletePage,
  duplicatePage,
  movePage,
  moveToFolder,
  pagesChangedByDeleting,
  renamePage,
  setHiddenFromNavigation,
  setHomePage,
} from "./page-actions.js";

/**
 * The Pages panel's actions on `session`: each change is one undo step (F-ED-13). Deleting a page
 * asks first through `siteWide`, saying how many pages it changes (D7).
 */
export function pagesPanelActions(
  session: EditorSession,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
): PagesPanelActions {
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
    remove: (pageId) => {
      const site = session.history.document.getState();
      const page = site.pages[pageId];
      if (page === undefined || siteWide === undefined) {
        deletePage(session, pageId);
        return;
      }
      void siteWide
        .confirmSiteWide({
          action: t("pages.deleteDialog.title", { name: page.title }),
          description: t("pages.deleteDialog.description"),
          confirm: t("pages.deleteDialog.confirm"),
          affectedPages: pagesChangedByDeleting(site, pageId),
        })
        .then((confirmed) => {
          if (confirmed) deletePage(session, pageId);
        });
    },
    changeSettings: (pageId, change) => changePageSettings(session, pageId, change),
  };
}

/** The menu editor's actions on `session`: each change is one undo step (F-ED-17). */
function menuPanelActions(session: EditorSession): MenuPanelActions {
  return {
    add: (item) => {
      addMenuItem(session, item);
    },
    rename: (id, label) => renameMenuItem(session, id, label),
    editLink: (id, label, change) => editMenuLink(session, id, label, change),
    setHidden: (id, hidden) => setMenuItemHidden(session, id, hidden),
    move: (id, to) => moveMenuItem(session, id, to),
    remove: (id) => removeMenuItem(session, id),
    followPages: () => followPages(session),
  };
}

/**
 * Whether two versions of the site list the same pages and menu the same way, whatever their
 * content.
 */
function samePageList(a: SiteDoc, b: SiteDoc): boolean {
  if (a.pageOrder !== b.pageOrder || a.homePageId !== b.homePageId || a.menu !== b.menu) {
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
 * Adds the Site panel to the right column, as the tab after Edit (UI1, ADR 0008), in Simple and
 * Advanced mode: Pages, and the navigation Menu under them. Returns a function that removes it.
 */
export function registerSitePanel(
  panels: PanelRegistry,
  session: EditorSession,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
): () => void {
  const actions = pagesPanelActions(session, siteWide);
  const menuActions = menuPanelActions(session);
  const linkContext = () => {
    const site = session.history.document.getState();
    return { site, targets: linkTargets(site, session.library) };
  };
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
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <PagesPanel site={site} shownPageId={shownPageId} actions={actions} />
        </div>
        <div className="max-h-[50%] shrink-0 overflow-y-auto border-t border-border">
          <MenuPanel site={site} linkContext={linkContext} actions={menuActions} />
        </div>
      </div>
    );
  }
  return panels.register({
    id: "site",
    slot: "right.bottom",
    title: t("panels.site"),
    component: SitePanel,
  });
}
