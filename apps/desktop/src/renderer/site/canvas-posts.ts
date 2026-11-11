import type { CanvasEngine } from "@webforge/engine";
import { type SiteCollection, type SiteDoc, sameJson, siteCollectionsOf } from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";

type Unsubscribe = () => void;

/**
 * Shows the site's posts in Latest posts sections on the canvas (6.10b): each Blog's posts, newest
 * first, drafts too, as they are now. Drawn again only when what the sections list changes (a
 * post's title, date, summary, picture or tags, or a post added or deleted), not on every edit of
 * a post's text. Not a document change, so no undo step.
 */
export function connectCanvasPosts(
  engine: Pick<CanvasEngine, "setPosts">,
  session: Pick<EditorSession, "history">,
): Unsubscribe {
  const { document } = session.history;
  let shown: readonly SiteCollection[] | undefined;
  let pages: SiteDoc["pages"] | undefined;
  let collections: SiteDoc["collections"] | undefined;
  const show = (site: SiteDoc) => {
    // An edit of something else (the theme, a page's sections) leaves the lists as they are.
    if (site.pages === pages && site.collections === collections) return;
    pages = site.pages;
    collections = site.collections;
    const next = siteCollectionsOf(site);
    if (shown !== undefined && sameJson(next, shown)) return;
    shown = next;
    engine.setPosts(
      next.length === 0
        ? undefined
        : (id) => (id === undefined ? next[0] : next.find((each) => each.id === id)),
    );
  };
  show(document.getState());
  return document.subscribe(show);
}
