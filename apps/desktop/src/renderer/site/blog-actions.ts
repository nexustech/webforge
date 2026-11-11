import { t } from "@webforge/i18n";
import {
  type CollectionDesign,
  type CollectionId,
  collectionById,
  freeCollectionFolder,
  newCollection,
  newId,
  type PageId,
  pageSlugFor,
  pageTitle,
  type SiteDoc,
} from "@webforge/model";
import { localDay } from "../editor/page-updated.js";
import { editShowing, type PagesSession } from "./page-actions.js";

/**
 * The Blog (6.10a, ADR 0025, M2-1): a post is a page that belongs to the Blog, written on the
 * canvas inside the Blog's design. Adding the Blog adds its first post, so the owner sees at once
 * what a post is, and each is one undo step.
 */

/** "post 'Spring opening'", for the history's "Added {item}" labels. */
const postItem = (name: string) => t("blog.item", { name });

/**
 * A new Blog's design (ADR 0025, decision 4): above each post, its title, date and picture; below
 * it, a button back to the Home page. Each element is bound to the post's field, so it shows each
 * post's own; the text beside the binding is what shows on a page that isn't a post.
 */
export function blogDesign(
  homeId: PageId,
  id: () => string = () => newId("node"),
): CollectionDesign {
  return {
    before: [
      {
        type: "Section",
        props: {
          id: id(),
          contentWidth: "narrow",
          content: [
            {
              type: "Heading",
              props: {
                id: id(),
                text: t("blog.design.title"),
                size: "large",
                bindings: { text: "item.title" },
              },
            },
            {
              type: "Text",
              props: {
                id: id(),
                text: `<p>${t("blog.design.date")}</p>`,
                bindings: { text: "item.date" },
              },
            },
            { type: "Image", props: { id: id(), bindings: { image: "item.picture" } } },
          ],
        },
      },
    ],
    after: [
      {
        type: "Section",
        props: {
          id: id(),
          contentWidth: "narrow",
          content: [
            {
              type: "Button",
              props: {
                id: id(),
                label: t("blog.design.home"),
                link: { kind: "page", pageId: homeId },
              },
            },
          ],
        },
      },
    ],
  };
}

/**
 * Adds post `id` called `title` to collection `collectionId` in `draft` (an undo step's): in the
 * collection's folder, dated today, before a "Page not found" page that is last. The menu doesn't
 * take it in: the Blog lists its posts.
 */
export function insertPost(
  draft: SiteDoc,
  collectionId: CollectionId,
  id: PageId,
  title: string,
  entry: Readonly<Record<string, string>> = {},
  today: string = localDay(),
): void {
  const collection = collectionById(draft, collectionId);
  if (collection === undefined) return;
  draft.pages[id] = {
    id,
    kind: "page",
    slug: pageSlugFor(draft, title, collection.folder),
    folder: collection.folder,
    title,
    collection: collectionId,
    entry: { date: today, ...entry },
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
    doc: {
      root: { props: {} },
      content: [
        {
          type: "Section",
          props: {
            id: newId("node"),
            contentWidth: "narrow",
            content: [
              { type: "Text", props: { id: newId("node"), text: t("blog.firstPost.text") } },
            ],
          },
        },
      ],
    },
  };
  const last = draft.pageOrder.at(-1);
  const beforeNotFound = last !== undefined && draft.pages[last]?.kind === "not-found";
  draft.pageOrder.splice(beforeNotFound ? -1 : draft.pageOrder.length, 0, id);
}

/**
 * Adds a Blog to `draft` (an undo step's), as collection `collectionId` from the Blog preset in a
 * folder no other has (`blog`), with a first post `postId` to show it.
 */
export function insertBlog(
  draft: SiteDoc,
  collectionId: CollectionId,
  postId: PageId,
  today: string = localDay(),
): void {
  draft.collections[collectionId] = newCollection({
    id: collectionId,
    preset: "blog",
    name: t("blog.name"),
    folder: freeCollectionFolder(draft, "blog"),
    labels: {
      date: t("blog.field.date"),
      summary: t("blog.field.summary"),
      picture: t("blog.field.picture"),
    },
    design: blogDesign(draft.homePageId),
  });
  insertPost(
    draft,
    collectionId,
    postId,
    t("blog.firstPost.title"),
    { summary: t("blog.firstPost.summary") },
    today,
  );
}

/**
 * *Add Page › Blog*: adds a Blog and its first post, and shows the post. One undo step ("Added a
 * blog"). Returns the post's id.
 */
export function addBlog(session: PagesSession): PageId {
  const collectionId = newId("collection");
  const postId = newId("page");
  editShowing(session, "insert", t("blog.history.addedBlog"), postId, (draft) =>
    insertBlog(draft, collectionId, postId),
  );
  return postId;
}

/**
 * *New Post* in the Blog's group: adds a post to collection `collectionId`, dated today, and shows
 * it. One undo step ("Added post 'New post'"). Returns its id, or null for a Blog there isn't or
 * an empty name.
 */
export function addPost(
  session: PagesSession,
  collectionId: CollectionId,
  name: string = t("blog.newPostTitle"),
): PageId | null {
  const title = pageTitle(name);
  if (
    title === "" ||
    collectionById(session.history.document.getState(), collectionId) === undefined
  ) {
    return null;
  }
  const id = newId("page");
  editShowing(session, "insert", t("history.added", { item: postItem(title) }), id, (draft) =>
    insertPost(draft, collectionId, id, title),
  );
  return id;
}
