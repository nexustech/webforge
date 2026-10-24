import type { ReadonlyStore } from "@webforge/history";
import type { PageEntry, PageId, SiteDoc } from "@webforge/model";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { EditorSelection, EditorSession } from "./editor-session.js";

/**
 * The part of the open site's document a component draws (R9): it redraws only when `selector`'s
 * result changes, as `equals` sees it (by reference unless given; zustand's `shallow` for a list
 * or record of references). A canvas keystroke changes the document, but rarely a panel's part of it.
 */
export function useDocument<T>(
  session: Pick<EditorSession, "history">,
  selector: (site: SiteDoc) => T,
  equals?: (a: T, b: T) => boolean,
): T {
  return useStoreWithEqualityFn(
    session.history.document as ReadonlyStore<SiteDoc>,
    selector,
    equals,
  );
}

/** The part of the UI state (page, selection, device view) a component draws; as {@link useDocument}. */
export function useUi<T>(
  session: Pick<EditorSession, "ui">,
  selector: (ui: EditorSelection) => T,
  equals?: (a: T, b: T) => boolean,
): T {
  return useStoreWithEqualityFn(session.ui, selector, equals);
}

/** A page as lists of pages show it: in the toolbar, the command palette, the Pages panel. */
export type PageListEntry = {
  readonly id: PageId;
  readonly title: string;
  /** Its file name without `.html`. */
  readonly slug: string;
  readonly kind: PageEntry["kind"];
};

/** Each document's page list, worked out once. */
const pageLists = new WeakMap<SiteDoc, readonly PageListEntry[]>();

/** The site's pages in their order, by id, title, file name and kind (R9); once per document. */
export function pageListOf(site: SiteDoc): readonly PageListEntry[] {
  const known = pageLists.get(site);
  if (known !== undefined) return known;
  const list = site.pageOrder.flatMap((id) => {
    const page = site.pages[id];
    return page === undefined ? [] : [{ id, title: page.title, slug: page.slug, kind: page.kind }];
  });
  pageLists.set(site, list);
  return list;
}

const samePage = (a: PageListEntry, b: PageListEntry | undefined) =>
  b !== undefined && a.id === b.id && a.title === b.title && a.slug === b.slug && a.kind === b.kind;

/**
 * Whether two page lists name the same pages, in the same order: a list redraws when a page is
 * added, renamed or moved, and not when one's content changes.
 */
export function samePages(a: readonly PageListEntry[], b: readonly PageListEntry[]): boolean {
  return a === b || (a.length === b.length && a.every((page, index) => samePage(page, b[index])));
}
