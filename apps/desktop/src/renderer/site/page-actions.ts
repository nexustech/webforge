import type { Recipe } from "@webforge/history";
import { t } from "@webforge/i18n";
import {
  findBrokenLinks,
  insertPage,
  type MediaId,
  newId,
  PAGE_DESCRIPTION_MAX,
  type PageEntry,
  type PageId,
  pageSlugFor,
  pageTitle,
  type SiteDoc,
  slugify,
  slugsInFolder,
  syncMenuWithPages,
  uniqueSlug,
} from "@webforge/model";
import type { EditKind, EditorSelection, EditorSession } from "../editor/editor-session.js";

/**
 * The Pages panel's actions (F-ED-13). Each is one labelled undo step ("Added page 'About'"), and
 * undo brings back the page that was shown (U3). Slugs follow the page name and stay unique in
 * their folder (X1). The "Page not found" page (F-ED-20) can't be deleted, duplicated, made the
 * Home page, moved into a folder or shown in navigation; the Home page can't be deleted or moved
 * into a folder.
 */

/** The parts of an editor session the actions use. */
export type PagesSession = Pick<EditorSession, "history" | "ui" | "edit">;

/** "page 'About'", for the history's "Added {item}" labels. */
const pageItem = (name: string) => t("pages.item", { name });

/**
 * The file a page named `name` in `folder` would get (`services/about.html`), as the add, rename
 * and folder dialogs show it. `pageId` is the page being renamed or moved, if any.
 */
export function fileNameFor(
  site: SiteDoc,
  name: string,
  folder: string | undefined,
  pageId?: PageId,
): string {
  const page = pageId === undefined ? undefined : site.pages[pageId];
  if (page !== undefined && page.id === site.homePageId) {
    return "index.html";
  }
  if (page?.kind === "not-found") {
    return "404.html";
  }
  const slug = pageSlugFor(site, name, folder, pageId);
  return folder === undefined ? `${slug}.html` : `${folder}/${slug}.html`;
}

/**
 * The folder a name means: an existing folder as it is (`services/cakes`), or a new one made
 * file-friendly ("Our Services" → `our-services`).
 */
function folderNamed(site: SiteDoc, name: string): string {
  return foldersOf(site).includes(name) ? name : uniqueSlug(slugify(name), new Set());
}

/** The file page `pageId` would get in the folder named `name`, as {@link moveToFolder} moves it. */
export function fileNameInFolder(site: SiteDoc, pageId: PageId, name: string): string {
  const folder = folderNamed(site, name);
  const slug = uniqueSlug(site.pages[pageId]?.slug ?? "", slugsInFolder(site, folder, pageId));
  return `${folder}/${slug}.html`;
}

/**
 * How many pages deleting `pageId` changes (D7): the page itself, and every page left with a link
 * to it, in its content or in what all pages share (the menu, the Header, the Footer).
 */
export function pagesChangedByDeleting(site: SiteDoc, pageId: PageId): number {
  const { [pageId]: _deleted, ...rest } = site.pages;
  const others = site.pageOrder.filter((id) => id !== pageId && site.pages[id] !== undefined);
  const linking = new Set(
    findBrokenLinks({ ...site, pages: rest })
      .filter((link) => "pageId" in link && link.pageId === pageId)
      .map((link) => link.on),
  );
  const shared = linking.has("menu") || linking.has("header") || linking.has("footer");
  return 1 + (shared ? others.length : others.filter((id) => linking.has(id)).length);
}

/** Runs `recipe` as one undo step, then shows `pageId` (the step remembers it for redo). */
function editShowing(
  session: PagesSession,
  kind: EditKind,
  label: string,
  pageId: PageId,
  recipe: Recipe<SiteDoc>,
): void {
  const current = session.ui.getState();
  const selectionAfter: EditorSelection =
    pageId === current.pageId ? current : { ...current, pageId, nodeId: null };
  session.edit(kind, label, recipe, { selectionAfter, apply: true });
}

/** Adds an empty page called `name` and shows it. Returns its id, or null for an empty name. */
export function addPage(session: PagesSession, name: string): PageId | null {
  const title = pageTitle(name);
  if (title === "") {
    return null;
  }
  const id = newId("page");
  editShowing(session, "insert", t("history.added", { item: pageItem(title) }), id, (draft) =>
    insertPage(draft, id, title),
  );
  return id;
}

/**
 * The slug a page gets when renamed to `title`: it follows the name (`About us` → `about-us`)
 * while it still matches the old name, and stays as it is once set by hand in Page Settings, so
 * a rename never breaks links to a file name the person chose.
 */
function slugAfterRename(site: SiteDoc, page: PageEntry, title: string): string {
  const followsName = page.slug === pageSlugFor(site, page.title, page.folder, page.id);
  return followsName ? pageSlugFor(site, title, page.folder, page.id) : page.slug;
}

/** The file a page would get if renamed to `name`, as the rename dialog shows it. */
export function renamedFileName(site: SiteDoc, pageId: PageId, name: string): string {
  const page = site.pages[pageId];
  if (page === undefined || page.id === site.homePageId || page.kind === "not-found") {
    return fileNameFor(site, name, page?.folder, pageId);
  }
  const slug = slugAfterRename(site, page, pageTitle(name));
  return page.folder === undefined ? `${slug}.html` : `${page.folder}/${slug}.html`;
}

/** Renames a page; its file name follows unless it was set by hand (see `slugAfterRename`). */
export function renamePage(session: PagesSession, pageId: PageId, name: string): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  const title = pageTitle(name);
  if (page === undefined || title === "" || title === page.title) {
    return;
  }
  const slug = slugAfterRename(site, page, title);
  session.edit("props", t("pages.history.renamed", { name: title }), (draft) => {
    const target = draft.pages[pageId];
    if (target !== undefined) {
      target.title = title;
      target.slug = slug;
    }
  });
}

/** Whether `page` can be duplicated: any page but "Page not found". */
export const canDuplicate = (page: PageEntry) => page.kind === "page";

/** Copies a page after itself, as "About (copy)", and shows the copy. Returns its id. */
export function duplicatePage(session: PagesSession, pageId: PageId): PageId | null {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  if (page === undefined || !canDuplicate(page)) {
    return null;
  }
  const id = newId("page");
  const title = pageTitle(t("pages.copyName", { name: page.title }));
  const label = t("history.duplicated", { item: pageItem(page.title) });
  // The home page's copy is an ordinary page, so it goes to the top level like the home page.
  const folder = pageId === site.homePageId ? undefined : page.folder;
  editShowing(session, "duplicate", label, id, (draft) => {
    draft.pages[id] = {
      id,
      kind: "page",
      slug: pageSlugFor(draft, title, folder),
      ...(folder === undefined ? {} : { folder }),
      title,
      settings: structuredClone(page.settings),
      doc: structuredClone(page.doc),
    };
    draft.pageOrder.splice(draft.pageOrder.indexOf(pageId) + 1, 0, id);
    draft.menu = syncMenuWithPages(draft, id);
  });
  return id;
}

/**
 * The page next to `pageId` in `direction` among the pages in the same folder, or undefined at
 * either end. The Pages panel shows each folder's pages together, so moves stay within one.
 */
export function neighbour(site: SiteDoc, pageId: PageId, direction: -1 | 1): PageId | undefined {
  const folder = site.pages[pageId]?.folder;
  const siblings = site.pageOrder.filter((id) => site.pages[id]?.folder === folder);
  return siblings[siblings.indexOf(pageId) + direction];
}

/** Moves a page up or down (the navigation order while the menu follows the pages). */
export function movePage(session: PagesSession, pageId: PageId, direction: -1 | 1): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  const other = neighbour(site, pageId, direction);
  if (page === undefined || other === undefined) {
    return;
  }
  session.edit("move", t("history.moved", { item: pageItem(page.title) }), (draft) => {
    const from = draft.pageOrder.indexOf(pageId);
    const to = draft.pageOrder.indexOf(other);
    draft.pageOrder[from] = other;
    draft.pageOrder[to] = pageId;
    draft.menu = syncMenuWithPages(draft);
  });
}

/** Whether `page` can go into a folder: not the Home page or the "Page not found" page. */
export const canMoveToFolder = (site: SiteDoc, page: PageEntry) =>
  page.kind === "page" && page.id !== site.homePageId;

/** The folders pages are in, sorted. */
export function foldersOf(site: SiteDoc): string[] {
  return [...new Set(Object.values(site.pages).flatMap((page) => page.folder ?? []))].toSorted();
}

/**
 * Moves a page into `folder` (a name, made file-friendly: "Our Services" → `our-services`), or to
 * the top level for undefined. Its slug changes only if the folder already has one like it.
 */
export function moveToFolder(
  session: PagesSession,
  pageId: PageId,
  folder: string | undefined,
): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  const target = folder === undefined ? undefined : folderNamed(site, folder);
  if (page === undefined || !canMoveToFolder(site, page) || target === page.folder) {
    return;
  }
  session.edit("move", t("history.moved", { item: pageItem(page.title) }), (draft) => {
    const moved = draft.pages[pageId];
    if (moved === undefined) {
      return;
    }
    moved.slug = uniqueSlug(moved.slug, slugsInFolder(draft, target, pageId));
    if (target === undefined) {
      delete moved.folder;
    } else {
      moved.folder = target;
    }
  });
}

/** Whether `page` can be the Home page: an ordinary page that isn't already. */
export const canBeHome = (site: SiteDoc, page: PageEntry) =>
  page.kind === "page" && page.id !== site.homePageId;

/** Makes a page the Home page (`index.html`), taking it out of its folder. */
export function setHomePage(session: PagesSession, pageId: PageId): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  if (page === undefined || !canBeHome(site, page)) {
    return;
  }
  session.edit("props", t("pages.history.setHome", { name: page.title }), (draft) => {
    const home = draft.pages[pageId];
    if (home === undefined) {
      return;
    }
    if (home.folder !== undefined) {
      home.slug = uniqueSlug(home.slug, slugsInFolder(draft, undefined, pageId));
      delete home.folder;
    }
    // The old Home page becomes an ordinary page: its slug may be reserved (`index`) or, from an
    // older site, used by another top-level page.
    const previous = draft.pages[draft.homePageId];
    if (previous !== undefined) {
      previous.slug = uniqueSlug(previous.slug, slugsInFolder(draft, undefined, previous.id));
    }
    draft.homePageId = pageId;
  });
}

/** Whether `page` can be shown in or hidden from navigation: never "Page not found". */
export const canChangeNavigation = (page: PageEntry) => page.kind === "page";

/** Hides a page from navigation, or shows it again. */
export function setHiddenFromNavigation(
  session: PagesSession,
  pageId: PageId,
  hidden: boolean,
): void {
  const page = session.history.document.getState().pages[pageId];
  if (
    page === undefined ||
    !canChangeNavigation(page) ||
    page.settings.hideFromNavigation === hidden
  ) {
    return;
  }
  const key = hidden ? "pages.history.hidden" : "pages.history.shown";
  session.edit("props", t(key, { name: page.title }), (draft) => {
    const target = draft.pages[pageId];
    if (target !== undefined) {
      target.settings.hideFromNavigation = hidden;
    }
  });
}

/** Whether `page` can be deleted: not the Home page or the "Page not found" page. */
export const canDelete = (site: SiteDoc, page: PageEntry) =>
  page.kind === "page" && page.id !== site.homePageId;

/**
 * Deletes a page (after the Pages panel's confirmation, D5). If it was shown, the Home page is
 * shown instead. Undo brings it back, shown again.
 */
export function deletePage(session: PagesSession, pageId: PageId): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  if (page === undefined || !canDelete(site, page)) {
    return;
  }
  const shown = session.ui.getState().pageId;
  const next = shown === pageId ? site.homePageId : shown;
  editShowing(
    session,
    "remove",
    t("history.deleted", { item: pageItem(page.title) }),
    next,
    (draft) => {
      delete draft.pages[pageId];
      draft.pageOrder.splice(draft.pageOrder.indexOf(pageId), 1);
      draft.menu = syncMenuWithPages(draft);
    },
  );
}

/** What Page Settings edits (F-SET-2). Empty `description` and no `shareImage` use the site's. */
export type PageSettingsChange = {
  readonly title: string;
  /** A file name as typed; made file-friendly and unique in the page's folder. */
  readonly slug: string;
  readonly description: string;
  readonly shareImage: MediaId | undefined;
  readonly hideHeader: boolean;
  readonly hideFooter: boolean;
  readonly hideFromNavigation: boolean;
  /** Leaves the site's back-to-top button off this page (F-CM-9). */
  readonly hideBackToTop: boolean;
};

/**
 * Applies Page Settings as one undo step, "Changed page settings", or nothing when nothing
 * changed. An empty title keeps the old one; "Page not found" stays out of navigation.
 */
export function changePageSettings(
  session: PagesSession,
  pageId: PageId,
  change: PageSettingsChange,
): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  if (page === undefined) {
    return;
  }
  const title = pageTitle(change.title) || page.title;
  // An emptied file name keeps the current one, as an emptied title does.
  const slug =
    change.slug.trim() === "" || slugify(change.slug) === page.slug
      ? page.slug
      : pageSlugFor(site, change.slug, page.folder, pageId);
  const description = change.description.trim().slice(0, PAGE_DESCRIPTION_MAX);
  const shareImage =
    change.shareImage !== undefined && site.media[change.shareImage]?.kind === "image"
      ? change.shareImage
      : undefined;
  const hideFromNavigation = page.kind === "not-found" || change.hideFromNavigation;
  const { settings } = page;
  if (
    title === page.title &&
    slug === page.slug &&
    description === (settings.description ?? "") &&
    shareImage === settings.shareImage &&
    change.hideHeader === settings.hideHeader &&
    change.hideFooter === settings.hideFooter &&
    hideFromNavigation === settings.hideFromNavigation &&
    change.hideBackToTop === (settings.hideBackToTop === true)
  ) {
    return;
  }
  session.edit("props", t("history.changedPage"), (draft) => {
    const target = draft.pages[pageId];
    if (target === undefined) {
      return;
    }
    target.title = title;
    target.slug = slug;
    target.settings = {
      ...(description === "" ? {} : { description }),
      ...(shareImage === undefined ? {} : { shareImage }),
      hideHeader: change.hideHeader,
      hideFooter: change.hideFooter,
      hideFromNavigation,
      // Absent when shown, as in files from before it.
      ...(change.hideBackToTop ? { hideBackToTop: true } : {}),
    };
  });
}
