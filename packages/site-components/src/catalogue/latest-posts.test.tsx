import type { MediaId, NodeDoc, SiteCollection, SiteCollectionItem } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { siteLibrary } from "./index.js";
import { POSTS_PER_PAGE } from "./latest-posts.js";

/** Post `n` of a Blog: newest first, every third tagged News, with a picture. */
const post = (n: number): SiteCollectionItem => ({
  pageId: `p${n}`,
  path: `blog/post-${n}`,
  values: {
    title: { kind: "text", text: `Post ${n}` },
    date: { kind: "date", date: `2026-01-${String(28 - n).padStart(2, "0")}` },
    summary: { kind: "text", text: `About ${n}` },
    picture: { kind: "image", mediaId: "photo" as MediaId },
    ...(n % 3 === 0
      ? { tags: { kind: "tags", tags: [{ name: "News", path: "blog/tag/news" }] } }
      : {}),
  },
});

const blog = (count: number): SiteCollection => ({
  id: "blog",
  name: "Blog",
  folder: "blog",
  items: Array.from({ length: count }, (_, n) => post(n + 1)),
});

function render(
  props: Record<string, unknown>,
  context: Partial<RenderContext> = {},
  withBlog = true,
): string {
  const defaults = siteLibrary.components.LatestPosts?.defaults;
  const node: NodeDoc = { type: "LatestPosts", props: { id: "latest", ...defaults, ...props } };
  return renderNodesToHtml([node], siteLibrary, {
    ...EDITOR_RENDER_CONTEXT,
    link: (path) => `${path}.html`,
    image: () => ({
      src: "photo.jpg",
      alt: "",
      width: 600,
      height: 400,
      sources: [],
      fallback: { type: "image/jpeg", srcset: "photo.jpg 600w" },
    }),
    language: "en-GB",
    ...(withBlog ? { posts: () => blog(25) } : {}),
    ...context,
  });
}

const titles = (html: string) => [...html.matchAll(/>(Post \d+)<\/a>/g)].map((match) => match[1]);

describe("Latest posts (6.10b)", () => {
  it("shows the newest posts as cards, with their picture, date, title and summary", () => {
    const html = render({});

    expect(titles(html)).toEqual(["Post 1", "Post 2", "Post 3"]);
    expect(html).toContain('href="blog/post-1.html"');
    expect(html).toContain('<time dateTime="2026-01-27"');
    expect(html).toContain("27 January 2026");
    expect(html).toContain("About 1");
    expect(html).toContain('src="photo.jpg"');
    expect(html).toContain('<a href="blog/index.html" class="link">All posts</a>');
  });

  it("leaves out what its options turn off, and lists titles as a list", () => {
    const html = render({
      count: "6",
      variant: "list",
      showDate: false,
      showSummary: false,
      allPosts: false,
    });

    expect(titles(html)).toHaveLength(6);
    expect(html).not.toContain("<time");
    expect(html).not.toContain("About 1");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("All posts");
  });

  it("lists a page of all the posts, with links to the newer and older pages", () => {
    const second = render({ page: 2 });

    expect(titles(second)).toEqual(
      Array.from({ length: POSTS_PER_PAGE }, (_, n) => `Post ${n + 11}`),
    );
    expect(second).toContain('href="blog/index.html" class="link" rel="prev"');
    expect(second).toContain('href="blog/page/3.html" class="link" rel="next"');
    expect(second).not.toContain("All posts");
    const last = render({ page: 3 });
    expect(titles(last)).toHaveLength(5);
    expect(last).not.toContain('rel="next"');
  });

  it("lists the posts with a tag, all of them", () => {
    const html = render({ tag: "blog/tag/news" });

    expect(titles(html)).toEqual([
      "Post 3",
      "Post 6",
      "Post 9",
      "Post 12",
      "Post 15",
      "Post 18",
      "Post 21",
      "Post 24",
    ]);
  });

  it("says when there are none, and hints at adding a blog on the canvas while there's none", () => {
    expect(render({}, { posts: () => blog(0) })).toContain("No posts yet.");
    expect(render({}, { elementHint: (missing) => `[${missing}]` }, false)).toContain("[blog]");
    // In the export, only its title.
    const bare = render({}, {}, false);
    expect(bare).toContain("Latest posts</h2>");
    expect(bare).not.toContain("<ul");
  });
});
