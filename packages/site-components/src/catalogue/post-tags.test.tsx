import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { siteLibrary } from "./index.js";

const render = (context: Partial<RenderContext>) =>
  renderNodesToHtml([{ type: "PostTags", props: { id: "tags" } }], siteLibrary, {
    ...EDITOR_RENDER_CONTEXT,
    link: (path) => `../${path}.html`,
    ...context,
  });

describe("Post tags (6.10b)", () => {
  it("links each of the post's tags to its page", () => {
    const html = render({
      item: () => ({
        kind: "tags",
        tags: [
          { name: "News", path: "blog/tag/news" },
          { name: "Opening times", path: "blog/tag/opening-times" },
        ],
      }),
    });

    expect(html).toContain('aria-label="Tags"');
    expect(html).toContain('<a href="../blog/tag/news.html" class="badge badge-outline">News</a>');
    expect(html).toContain(">Opening times</a>");
  });

  it("draws nothing on a page that isn't a post, and the hint on a post without tags", () => {
    expect(render({})).toBe("");
    expect(render({ item: () => undefined })).toBe("");
    expect(render({ item: () => undefined, emptyItem: (field) => `[${field}]` })).toContain(
      "[tags]",
    );
  });
});
