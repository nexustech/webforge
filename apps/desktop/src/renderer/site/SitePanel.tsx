import { t } from "@webforge/i18n";
import type { CollectionId, SiteDoc } from "@webforge/model";
import { FilesIcon } from "lucide-react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { ChosenPostFiles } from "../../shared/ipc/posts.js";
import type { EditorSession } from "../editor/editor-session.js";
import { useDocument, useUi } from "../editor/use-document.js";
import { linkTargets } from "../links/index.js";
import {
  addMenuItem,
  editMenuLink,
  followPages,
  MenuPanel,
  type MenuPanelActions,
  moveMenuItem,
  removeMenuItem,
  renameMenuItem,
  setMenuItemHidden,
} from "../menu/index.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PanelRegistry } from "../shell/panels.js";
import { addBlog, addPost } from "./blog-actions.js";
import { importPosts, postsFromFiles } from "./import-posts.js";
import { PagesPanel, type PagesPanelActions } from "./PagesPanel.js";
import {
  addPage,
  addPolicyPage,
  addSuggestedPage,
  changePageSettings,
  deletePage,
  duplicatePage,
  movePage,
  moveToFolder,
  pagesChangedByDeleting,
  renamePage,
  setDraftPage,
  setHiddenFromNavigation,
  setHomePage,
} from "./page-actions.js";

/**
 * The Pages panel's actions on `session`: each change is one undo step (F-ED-13). Deleting a page
 * asks first through `siteWide`, saying how many pages it changes (D7). Once the site has been
 * `published`, a page moved to a folder, made the Home page or given a new file name keeps its old
 * address working (#862); a rename asks.
 */
export function pagesPanelActions(
  session: EditorSession,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
  published: () => boolean = () => false,
  imports?: PostImports,
): PagesPanelActions {
  return {
    importPosts: (collectionId) => {
      if (imports !== undefined) void importChosenPosts(session, collectionId, imports);
    },
    show: (pageId) => session.showPage(pageId),
    add: (name) => {
      addPage(session, name);
    },
    addSuggested: (recipeId) => {
      addSuggestedPage(session, recipeId);
    },
    addPolicy: (kind) => {
      addPolicyPage(session, kind);
    },
    addBlog: () => {
      addBlog(session);
    },
    addPost: (collectionId) => {
      addPost(session, collectionId);
    },
    rename: (pageId, name, keepOldAddress) => renamePage(session, pageId, name, keepOldAddress),
    duplicate: (pageId) => {
      duplicatePage(session, pageId);
    },
    move: (pageId, direction) => movePage(session, pageId, direction),
    moveToFolder: (pageId, folder) => moveToFolder(session, pageId, folder, published()),
    setHome: (pageId) => setHomePage(session, pageId, published()),
    setHidden: (pageId, hidden) => setHiddenFromNavigation(session, pageId, hidden),
    setDraft: (pageId, draft) => setDraftPage(session, pageId, draft),
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
    changeSettings: (pageId, change) => changePageSettings(session, pageId, change, published()),
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
  // Add Page offers the cookie policy while Google Analytics is on (#866).
  if (a.settings.analytics.measurementId !== b.settings.analytics.measurementId) return false;
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

/** What *Import Posts…* needs (6.10b): main's file dialog, and a way to tell how it went. */
export type PostImports = {
  readonly chooseFiles: () => Promise<ChosenPostFiles>;
  readonly notify: (message: string, failed: boolean) => void;
};

/**
 * *Import Posts…* (6.10b): the files the person chooses, read in main, added to the Blog
 * `collectionId` as one undo step, and a line saying how many, or why none.
 */
export async function importChosenPosts(
  session: EditorSession,
  collectionId: CollectionId,
  { chooseFiles, notify }: PostImports,
): Promise<void> {
  const chosen = await chooseFiles();
  switch (chosen.status) {
    case "cancelled":
      return;
    case "tooMany":
      return notify(t("blog.import.tooMany"), true);
    case "tooLarge":
      return notify(t("blog.import.tooLarge", { name: chosen.name }), true);
    case "chosen": {
      const count = importPosts(session, collectionId, postsFromFiles(chosen.files));
      if (count === 0) return notify(t("blog.import.none"), true);
      return notify(
        count === 1 ? t("blog.import.done.one") : t("blog.import.done.other", { count }),
        false,
      );
    }
  }
}

/**
 * Adds the Site panel to the right column, as the tab after Edit (UI1, ADR 0008), in Simple and
 * Advanced mode: Pages, and the navigation Menu under them. Returns a function that removes it.
 */
export function registerSitePanel(
  panels: PanelRegistry,
  session: EditorSession,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
  /** The year the site was last published in, none when it hasn't been (F-CM-8, #862). */
  publishedYear: StoreApi<number | undefined> = createStore<number | undefined>(() => undefined),
  /** *Import Posts…*'s files and messages (6.10b); none in stories, where it does nothing. */
  imports?: PostImports,
): () => void {
  const published = () => publishedYear.getState() !== undefined;
  const actions = pagesPanelActions(session, siteWide, published, imports);
  const menuActions = menuPanelActions(session);
  const linkContext = () => {
    const site = session.history.document.getState();
    return { site, targets: linkTargets(site, session.library) };
  };
  function SitePanel() {
    // The site as the panel last showed it, kept while only page content changes, so typing on
    // the canvas doesn't re-render the panel.
    const site = useDocument(session, (current) => current, samePageList);
    const shownPageId = useUi(session, (ui) => ui.pageId);
    const isPublished = useStore(publishedYear, (year) => year !== undefined);
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <PagesPanel
            site={site}
            shownPageId={shownPageId}
            published={isPublished}
            actions={actions}
          />
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
    icon: FilesIcon,
    component: SitePanel,
  });
}
