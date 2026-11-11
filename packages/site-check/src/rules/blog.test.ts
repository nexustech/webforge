import type { CollectionId, PageEntry, PageId, SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { findIn, siteWith } from "../test-site.test-helper.js";
import { blogFeedRule, postPictureRule, postSummaryRule } from "./blog.js";

const BLOG = "blog" as CollectionId;

/** A site with a Blog and posts `entries`, the second a draft when `draft`. */
function blogSite(entries: Record<string, string>[], draft = false): SiteDoc {
  const site = siteWith();
  site.collections[BLOG] = {
    id: BLOG,
    preset: "blog",
    name: "Blog",
    folder: "blog",
    fields: [
      { name: "date", label: "Date", kind: "date" },
      { name: "summary", label: "Summary", kind: "text" },
      { name: "picture", label: "Picture", kind: "image" },
    ],
    design: { before: [], after: [] },
  };
  entries.forEach((entry, index) => {
    const id = `post-${index + 1}` as PageId;
    const page: PageEntry = {
      id,
      kind: "page",
      slug: id,
      folder: "blog",
      title: `Post ${index + 1}`,
      collection: BLOG,
      entry,
      settings: {
        hideHeader: false,
        hideFooter: false,
        hideFromNavigation: false,
        ...(draft && index === 1 ? { draft: true } : {}),
      },
      doc: { root: { props: {} }, content: [] },
    };
    site.pages[id] = page;
    site.pageOrder.splice(1, 0, id);
  });
  return site;
}

describe("a Blog's posts in Site Check (6.10b)", () => {
  it("finds published posts without a summary or a picture, at their Page Settings", () => {
    const site = blogSite([{ summary: "Open", picture: "photo" }, {}, { summary: " " }], true);

    expect(findIn(postSummaryRule, site)).toEqual([
      { key: "post-3/summary", place: { kind: "page", pageId: "post-3" } },
    ]);
    expect(findIn(postPictureRule, site).map((finding) => finding.key)).toEqual(["post-3/picture"]);
  });

  it("says a Blog has no feed until Site Settings have the web address", () => {
    const site = blogSite([{}]);

    expect(findIn(blogFeedRule, site)).toEqual([{ key: "address", place: { kind: "address" } }]);
    site.settings.address.url = "https://rosas.example";
    expect(findIn(blogFeedRule, site)).toEqual([]);
    expect(findIn(blogFeedRule, blogSite([]))).toEqual([]);
    expect(findIn(postSummaryRule, siteWith())).toEqual([]);
  });
});
