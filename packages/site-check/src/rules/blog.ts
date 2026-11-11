import {
  type Collection,
  collectionItems,
  type ItemValue,
  itemValue,
  type SiteDoc,
} from "@webforge/model";
import type { CheckRule, Finding } from "../types.js";

/**
 * The Blog's posts (6.10b): what lists of posts and shares show of each, its summary and its
 * picture, missing from a published post. Tips: a post reads without them, but its card is bare.
 */

/** The published posts of `site`'s collections that have a field of `kind` empty, by the field. */
function postsWithout(site: SiteDoc, kind: ItemValue["kind"], name: string): Finding[] {
  const found: Finding[] = [];
  for (const collection of Object.values(site.collections) as Collection[]) {
    if (!collection.fields.some((field) => field.name === name && field.kind === kind)) continue;
    for (const page of collectionItems(site, collection.id)) {
      if (itemValue(collection, page, name) === undefined) {
        found.push({ key: `${page.id}/${name}`, place: { kind: "page", pageId: page.id } });
      }
    }
  }
  return found;
}

/** A post without its summary, which Latest posts, the Blog's pages and its feed show. */
export const postSummaryRule: CheckRule = {
  id: "postSummary",
  level: "tip",
  check: ({ site }) => postsWithout(site, "text", "summary"),
};

/** A post without its picture, which its Blog's design, its card and its shares show. */
export const postPictureRule: CheckRule = {
  id: "postPicture",
  level: "tip",
  check: ({ site }) => postsWithout(site, "image", "picture"),
};

/** A Blog with posts and no feed, for want of the site's web address, which a feed's links need. */
export const blogFeedRule: CheckRule = {
  id: "blogFeed",
  level: "tip",
  check: ({ site }) =>
    (site.settings.address.url ?? "") === "" &&
    Object.values(site.collections).some(
      (collection) => collectionItems(site, collection.id).length > 0,
    )
      ? [{ key: "address", place: { kind: "address" } }]
      : [],
};
