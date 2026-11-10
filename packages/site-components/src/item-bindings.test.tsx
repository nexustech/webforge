import type { ItemValue, MediaId, NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { dateText, EDITOR_RENDER_CONTEXT } from "./library.js";
import { renderNodesToHtml } from "./render-static.js";
import type { RenderContext } from "./schema.js";

const VALUES: Readonly<Record<string, ItemValue>> = {
  title: { kind: "text", text: "Spring opening" },
  date: { kind: "date", date: "2026-11-10" },
  summary: { kind: "text", text: "Doors open at nine" },
  picture: { kind: "image", mediaId: "photo" as MediaId },
};

/** The design's elements: a title, a date, a summary and a picture, bound to the post's. */
const design: NodeDoc[] = [
  { type: "Heading", props: { id: "h", text: "Title", bindings: { text: "item.title" } } },
  { type: "Text", props: { id: "d", text: "<p>Date</p>", bindings: { text: "item.date" } } },
  { type: "Text", props: { id: "s", text: "<p>Summary</p>", bindings: { text: "item.summary" } } },
  { type: "Image", props: { id: "i", bindings: { image: "item.picture" } } },
];

const image: RenderContext["image"] = (id) =>
  id === "photo"
    ? {
        src: "photo.jpg",
        alt: "",
        width: 800,
        height: 600,
        sources: [],
        fallback: { type: "image/jpeg", srcset: "photo.jpg 800w" },
      }
    : null;

function render(context: Partial<RenderContext>): string {
  return renderNodesToHtml(design, siteLibrary, {
    ...EDITOR_RENDER_CONTEXT,
    image,
    language: "en-GB",
    ...context,
  });
}

describe("elements bound to a post's fields (6.10a, ADR 0025)", () => {
  it("show the post's title, date, summary and picture", () => {
    const html = render({ item: (field) => VALUES[field] });

    expect(html).toContain("Spring opening</h2>");
    expect(html).toContain('<time dateTime="2026-11-10">10 November 2026</time>');
    expect(html).toContain("<p>Doors open at nine</p>");
    expect(html).toContain('src="photo.jpg"');
    expect(html).not.toContain("Summary");
  });

  it("show nothing for an empty field in the export, and the hint on the canvas", () => {
    expect(render({ item: () => undefined })).not.toMatch(/Title|Date|Summary|<img/);
    const hinted = render({ item: () => undefined, emptyItem: (field) => `[${field}]` });
    expect(hinted).toContain("[title]");
    expect(hinted).toContain("[summary]");
  });

  it("show their own text on a page that isn't a post", () => {
    const html = render({});

    expect(html).toContain("Title</h2>");
    expect(html).toContain("<p>Date</p>");
  });
});

describe("dateText (6.10a)", () => {
  it("writes a day as the site's language does, or as stored without one", () => {
    expect(dateText("2026-11-10", "en-GB")).toBe("10 November 2026");
    expect(dateText("2026-11-10", "en-US")).toBe("November 10, 2026");
    expect(dateText("2026-11-10", undefined)).toBe("2026-11-10");
    expect(dateText("2026-11-10", "not a language!")).toBe("2026-11-10");
  });
});
