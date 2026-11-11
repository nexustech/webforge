import type { CollectionId, NodeDoc, PageId, SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { exportedPlaces } from "./fields.js";
import { altTextRule } from "./rules/content.js";
import { mainHeadingRule } from "./rules/found.js";
import { notesRule } from "./rules/notes.js";
import { element, findIn, image, siteWith } from "./test-site.test-helper.js";

const BLOG = "blog" as CollectionId;

/** A site with a Blog whose design holds `design`, and a post for each of `drafts` (a draft or not). */
function blogSite(design: NodeDoc[], drafts: readonly boolean[]): SiteDoc {
  const site = siteWith([element("Heading", "home-title", { size: "large", text: "Bakery" })], {
    media: { photo: image("photo", { alt: "" }) } as SiteDoc["media"],
  });
  site.collections[BLOG] = {
    id: BLOG,
    preset: "blog",
    name: "Blog",
    folder: "blog",
    fields: [],
    design: { before: design, after: [] },
  };
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  drafts.forEach((draft, at) => {
    const id = `post-${at}` as PageId;
    site.pages[id] = {
      ...home,
      id,
      slug: `post-${at}`,
      folder: "blog",
      title: `Post ${at}`,
      collection: BLOG,
      settings: { ...home.settings, draft },
      doc: { root: { props: {} }, content: [element("Text", `body-${at}`, { text: "<p>Hi</p>" })] },
    };
    site.pageOrder.push(id);
  });
  return site;
}

const picture = element("Image", "design-photo", { image: { mediaId: "photo" } });

describe("a Blog's design in Site Check (#936)", () => {
  it("checks the design once, as a place of its own, however many posts show it", () => {
    const site = blogSite([picture], [false, false, false]);

    expect(findIn(altTextRule, site).map((finding) => finding.place)).toEqual([
      { kind: "element", on: BLOG, nodeId: "design-photo" },
    ]);
  });

  it("leaves the design out while every post is a draft, as the export does", () => {
    const drafts = blogSite([picture], [true]);

    expect(exportedPlaces(drafts)(BLOG)).toBe(false);
    expect(exportedPlaces(blogSite([], [true, false]))(BLOG)).toBe(true);
    expect(findIn(altTextRule, drafts)).toEqual([]);
    // A note is for the person, wherever it is.
    const noted = blogSite([element("Section", "top", { note: "Add the date" })], [true]);
    expect(findIn(notesRule, noted).map((finding) => finding.place)).toEqual([
      { kind: "element", on: BLOG, nodeId: "top" },
    ]);
  });

  it("counts the design's main heading, the post's title, on each post", () => {
    const title = element("Heading", "post-title", { size: "large", text: "Title" });

    expect(findIn(mainHeadingRule, blogSite([title], [false]))).toEqual([]);
    expect(findIn(mainHeadingRule, blogSite([], [false])).map((finding) => finding.key)).toEqual([
      "post-0",
    ]);
  });
});
