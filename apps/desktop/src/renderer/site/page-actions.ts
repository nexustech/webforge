import type { Recipe } from "@webforge/history";
import { t } from "@webforge/i18n";
import {
  canDeletePage,
  collectionOf,
  deletePageFrom,
  insertPage,
  keepingOldAddresses,
  type MediaId,
  newId,
  PAGE_DESCRIPTION_MAX,
  type PageEntry,
  type PageId,
  pageFile,
  pageNeighbour,
  pageSlugFor,
  pagesChangedByDeleting,
  pageTitle,
  renamePageIn,
  type SiteDoc,
  sameJson,
  slugAfterRename,
  slugify,
  slugsInFolder,
  swapPages,
  syncMenuWithPages,
  tidyKeptAddresses,
  uniqueSlug,
} from "@webforge/model";
import { insertRecipePage, PAGE_RECIPES } from "@webforge/templates";
import type { EditKind, EditorSelection, EditorSession } from "../editor/editor-session.js";
import { insertCookiePage } from "./cookie-page.js";
import type { PolicyPageKind } from "./policy-sections.js";
import { insertPrivacyPage } from "./privacy-page.js";
import { insertTermsPage } from "./terms-page.js";

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

/** How many pages deleting a page changes (D7): the model's, shared with AI apps (4.11). */
export { pagesChangedByDeleting };

/** Runs `recipe` as one undo step, then shows `pageId` (the step remembers it for redo). */
export function editShowing(
  session: PagesSession,
  kind: EditKind,
  label: string,
  pageId: PageId,
  recipe: Recipe<SiteDoc>,
): void {
  const current = session.ui.getState();
  const selectionAfter: EditorSelection =
    pageId === current.pageId ? current : { ...current, pageId, nodeId: null };
  // A page added where an old address was kept takes it: the list loses it in the same step (#862).
  const tidied: Recipe<SiteDoc> = (draft) => {
    recipe(draft);
    tidyKeptAddresses(draft);
  };
  session.edit(kind, label, tidied, { selectionAfter, apply: true });
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
 * Adds a page made from page recipe `recipeId` (QS-3, 3.11a): its sections, in the site's theme,
 * named and described as the recipe says. Shows it. Returns its id, or null for a recipe there
 * isn't.
 */
export function addSuggestedPage(session: PagesSession, recipeId: string): PageId | null {
  const recipe = PAGE_RECIPES.find((each) => each.id === recipeId);
  if (recipe === undefined) {
    return null;
  }
  const id = newId("page");
  editShowing(
    session,
    "insert",
    t("history.added", { item: pageItem(recipe.title) }),
    id,
    (draft) => insertRecipePage(draft, id, recipe),
  );
  return id;
}

/** Each page *Add Page* writes for the owner to start from: its name, and how it's written. */
const POLICY_PAGES: Readonly<
  Record<PolicyPageKind, { title(): string; insert(draft: SiteDoc, id: PageId): void }>
> = {
  privacy: { title: () => t("privacyPage.title"), insert: insertPrivacyPage },
  terms: { title: () => t("termsPage.title"), insert: insertTermsPage },
  cookies: { title: () => t("cookiePage.title"), insert: insertCookiePage },
};

/**
 * Adds a page written from Site Settings for the owner to start from (#855, #866): the privacy
 * page, marked as the one Site Check looks for; the terms; or the cookie policy. Shows it. One
 * undo step ("Added page 'Terms'"). Returns its id.
 */
export function addPolicyPage(session: PagesSession, kind: PolicyPageKind): PageId {
  const id = newId("page");
  const page = POLICY_PAGES[kind];
  editShowing(
    session,
    "insert",
    t("history.added", { item: pageItem(page.title()) }),
    id,
    (draft) => page.insert(draft, id),
  );
  return id;
}

/**
 * Makes `change` to `draft`, which may change pages' addresses, keeping each old one working when
 * `keep` (#862): listed in Site Settings, written by the export. Either way, the list loses the
 * addresses a page has again.
 */
function changingAddresses(draft: SiteDoc, keep: boolean, change: () => void): void {
  if (keep) {
    keepingOldAddresses(draft, change);
    return;
  }
  change();
  tidyKeptAddresses(draft);
}

/**
 * Whether renaming page `pageId` to `name` changes its address: an ordinary page, not the Home
 * page, whose file name follows its name.
 */
export function renameMovesPage(site: SiteDoc, pageId: PageId, name: string): boolean {
  const page = site.pages[pageId];
  if (page === undefined || page.kind !== "page" || pageId === site.homePageId) return false;
  const title = pageTitle(name);
  return title !== "" && renamedFileName(site, pageId, title) !== pageFile(site, pageId);
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

/**
 * Renames a page; its file name follows unless it was set by hand (see `slugAfterRename`). With
 * `keepOldAddress`, its old address keeps working, in the same undo step (#862).
 */
export function renamePage(
  session: PagesSession,
  pageId: PageId,
  name: string,
  keepOldAddress = false,
): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  const title = pageTitle(name);
  if (page === undefined || title === "" || title === page.title) {
    return;
  }
  session.edit("props", t("pages.history.renamed", { name: title }), (draft) =>
    changingAddresses(draft, keepOldAddress, () => renamePageIn(draft, pageId, title)),
  );
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
      // A post's copy is another post of its Blog, with its fields (6.10a).
      ...(page.collection === undefined ? {} : { collection: page.collection }),
      ...(page.entry === undefined ? {} : { entry: structuredClone(page.entry) }),
      settings: structuredClone(page.settings),
      doc: structuredClone(page.doc),
    };
    draft.pageOrder.splice(draft.pageOrder.indexOf(pageId) + 1, 0, id);
    draft.menu = syncMenuWithPages(draft, id);
  });
  return id;
}

/** The page next to a page among its folder's pages: the model's, shared with AI apps (4.11). */
export const neighbour = pageNeighbour;

/** Moves a page up or down (the navigation order while the menu follows the pages). */
export function movePage(session: PagesSession, pageId: PageId, direction: -1 | 1): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  const other = neighbour(site, pageId, direction);
  if (page === undefined || other === undefined) {
    return;
  }
  session.edit("move", t("history.moved", { item: pageItem(page.title) }), (draft) =>
    swapPages(draft, pageId, other),
  );
}

/**
 * Whether `page` can go into a folder: not the Home page or the "Page not found" page, and not a
 * Blog's post, which is always in the Blog's folder (6.10a).
 */
export const canMoveToFolder = (site: SiteDoc, page: PageEntry) =>
  page.kind === "page" && page.id !== site.homePageId && page.collection === undefined;

/** The folders pages are in, sorted. */
export function foldersOf(site: SiteDoc): string[] {
  return [...new Set(Object.values(site.pages).flatMap((page) => page.folder ?? []))].toSorted();
}

/**
 * Moves a page into `folder` (a name, made file-friendly: "Our Services" → `our-services`), or to
 * the top level for undefined. Its slug changes only if the folder already has one like it. With
 * `keepOldAddress`, its old address keeps working (#862).
 */
export function moveToFolder(
  session: PagesSession,
  pageId: PageId,
  folder: string | undefined,
  keepOldAddress = false,
): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  const target = folder === undefined ? undefined : folderNamed(site, folder);
  if (page === undefined || !canMoveToFolder(site, page) || target === page.folder) {
    return;
  }
  session.edit("move", t("history.moved", { item: pageItem(page.title) }), (draft) =>
    changingAddresses(draft, keepOldAddress, () => {
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
    }),
  );
}

/** Whether `page` can be the Home page: an ordinary page that isn't already, nor a Blog's post. */
export const canBeHome = (site: SiteDoc, page: PageEntry) =>
  page.kind === "page" && page.id !== site.homePageId && page.collection === undefined;

/**
 * Makes a page the Home page (`index.html`), taking it out of its folder. With `keepOldAddress`,
 * the page's old address keeps working, and the old Home page's new one is its own (#862).
 */
export function setHomePage(session: PagesSession, pageId: PageId, keepOldAddress = false): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  if (page === undefined || !canBeHome(site, page)) {
    return;
  }
  session.edit("props", t("pages.history.setHome", { name: page.title }), (draft) =>
    changingAddresses(draft, keepOldAddress, () => setHomeIn(draft, pageId)),
  );
}

/** Makes page `pageId` the Home page in `draft`: {@link setHomePage}'s change. */
function setHomeIn(draft: SiteDoc, pageId: PageId): void {
  const home = draft.pages[pageId];
  if (home === undefined) {
    return;
  }
  if (home.folder !== undefined) {
    home.slug = uniqueSlug(home.slug, slugsInFolder(draft, undefined, pageId));
    delete home.folder;
  }
  // The Home page is always published (G37, #864): a draft made Home is a draft no longer, so it
  // doesn't become one again when another page is made Home.
  delete home.settings.draft;
  // The old Home page becomes an ordinary page: its slug may be reserved (`index`) or, from an
  // older site, used by another top-level page.
  const previous = draft.pages[draft.homePageId];
  if (previous !== undefined) {
    previous.slug = uniqueSlug(previous.slug, slugsInFolder(draft, undefined, previous.id));
  }
  draft.homePageId = pageId;
}

/** Whether `page` can be shown in or hidden from navigation: never "Page not found". */
export const canChangeNavigation = (page: PageEntry) =>
  page.kind === "page" && page.collection === undefined;

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

/** Whether `page` can be a draft (G37, #864): never the Home page or "Page not found". */
export const canBeDraft = (site: SiteDoc, page: PageEntry) =>
  page.kind === "page" && page.id !== site.homePageId;

/**
 * Makes a page a draft (G37, #864), kept in the site and left out of the export, a publish and the
 * preview, or takes it out of drafts. One undo step.
 */
export function setDraftPage(session: PagesSession, pageId: PageId, isDraft: boolean): void {
  const site = session.history.document.getState();
  const page = site.pages[pageId];
  if (page === undefined || !canBeDraft(site, page) || (page.settings.draft === true) === isDraft) {
    return;
  }
  const key = isDraft ? "pages.history.drafted" : "pages.history.undrafted";
  session.edit("props", t(key, { name: page.title }), (draft) => {
    const target = draft.pages[pageId];
    if (target === undefined) return;
    // Absent when published, as in files from before drafts (ADR 0012).
    if (isDraft) target.settings.draft = true;
    else delete target.settings.draft;
  });
}

/** Whether `page` can be deleted: not the Home page or the "Page not found" page. */
export const canDelete = canDeletePage;

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
    (draft) => deletePageFrom(draft, pageId),
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
  /** Keeps search engines from showing this page (3.15, SEO-2); absent from older callers. */
  readonly hideFromSearch?: boolean;
  /** Marks the site's privacy page (#855); absent from older callers, which keep the page's own. */
  readonly privacy?: boolean;
  /** A draft page (G37, #864); absent from older callers, which keep the page's own. */
  readonly draft?: boolean;
  /**
   * A post's field values by field name (6.10a): its date, summary and picture, `""` for none.
   * Only a post's, and only its Blog's fields; absent from callers that don't change them.
   */
  readonly entry?: Readonly<Record<string, string>> | undefined;
};

/** A post's field values as `change` leaves them: only its Blog's fields, empty ones left out. */
function entryAfter(
  site: SiteDoc,
  page: PageEntry,
  change: PageSettingsChange,
): Record<string, string> | undefined {
  const collection = collectionOf(site, page);
  if (collection === undefined || change.entry === undefined) return page.entry;
  const entry: Record<string, string> = {};
  for (const { name } of collection.fields) {
    const value = Object.hasOwn(change.entry, name) ? change.entry[name]?.trim() : undefined;
    if (value !== undefined && value !== "") entry[name] = value;
  }
  return Object.keys(entry).length === 0 ? undefined : entry;
}

/**
 * Applies Page Settings as one undo step, "Changed page settings", or nothing when nothing
 * changed. An empty title keeps the old one; "Page not found" stays out of navigation. With
 * `keepOldAddress`, a new file name keeps the old address working (#862).
 */
export function changePageSettings(
  session: PagesSession,
  pageId: PageId,
  change: PageSettingsChange,
  keepOldAddress = false,
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
  // "Page not found" is kept out of search engines whatever this says.
  const hideFromSearch =
    page.kind === "page" && (change.hideFromSearch ?? page.settings.hideFromSearch === true);
  // "Page not found" is never the privacy page.
  const privacy = page.kind === "page" && (change.privacy ?? page.settings.privacy === true);
  // The Home page and "Page not found" are always published.
  const isDraft = canBeDraft(site, page) && (change.draft ?? page.settings.draft === true);
  const entry = entryAfter(site, page, change);
  const { settings } = page;
  if (
    title === page.title &&
    slug === page.slug &&
    description === (settings.description ?? "") &&
    shareImage === settings.shareImage &&
    change.hideHeader === settings.hideHeader &&
    change.hideFooter === settings.hideFooter &&
    hideFromNavigation === settings.hideFromNavigation &&
    change.hideBackToTop === (settings.hideBackToTop === true) &&
    hideFromSearch === (settings.hideFromSearch === true) &&
    privacy === (settings.privacy === true) &&
    isDraft === (settings.draft === true) &&
    sameJson(entry, page.entry)
  ) {
    return;
  }
  const label =
    page.collection === undefined ? t("history.changedPage") : t("blog.history.changedPost");
  session.edit("props", label, (draft) => {
    const target = draft.pages[pageId];
    if (target === undefined) {
      return;
    }
    target.title = title;
    // A new file name keeps the old address working when asked (#862).
    changingAddresses(draft, keepOldAddress, () => {
      target.slug = slug;
    });
    target.settings = {
      ...(description === "" ? {} : { description }),
      ...(shareImage === undefined ? {} : { shareImage }),
      hideHeader: change.hideHeader,
      hideFooter: change.hideFooter,
      hideFromNavigation,
      // Absent when shown, as in files from before them.
      ...(change.hideBackToTop ? { hideBackToTop: true } : {}),
      ...(hideFromSearch ? { hideFromSearch: true } : {}),
      ...(privacy ? { privacy: true } : {}),
      ...(isDraft ? { draft: true } : {}),
    };
    // A post's fields (6.10a); a page with none has no entry.
    if (!sameJson(entry, target.entry)) {
      if (entry === undefined) delete target.entry;
      else target.entry = entry;
    }
  });
}
