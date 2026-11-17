import { siteTextFor } from "@webforge/i18n/site-text";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { siteLibrary } from "./index.js";

const ADDRESS = "https://rosasbakery.co.uk/blog/spring-opening.html";
const ENCODED = encodeURIComponent(ADDRESS);

/** Share buttons drawn with `context` over the editor's, on a post unless `post` is false. */
const render = (context: Partial<RenderContext>, post = true) =>
  renderNodesToHtml([{ type: "ShareButtons", props: { id: "share" } }], siteLibrary, {
    ...EDITOR_RENDER_CONTEXT,
    ...(post ? { item: () => undefined } : {}),
    ...context,
  });

/** The links' addresses in `html`, in order. */
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);

describe("Share buttons (6.17b)", () => {
  it("links to each network's share page with the post's whole address, encoded, and nothing else", () => {
    const html = render({ pageAddress: ADDRESS });

    expect(html).toContain("Share this post");
    expect(hrefs(html)).toEqual([
      `mailto:?body=${ENCODED}`,
      `https://wa.me/?text=${ENCODED}`,
      `https://www.facebook.com/sharer/sharer.php?u=${ENCODED}`,
      `https://x.com/intent/post?url=${ENCODED}`,
      `https://www.linkedin.com/sharing/share-offsite/?url=${ENCODED}`,
    ]);
    // Plain links: no script, nothing that loads, nothing opened for the visitor.
    expect(html).not.toMatch(/<script|<img|<iframe|target=/);
  });

  it("encodes an address's every character that means something in a link", () => {
    const address = "https://example.com/blog/a&b?c=d#e.html";
    const html = render({ pageAddress: address });

    expect(html).toContain("wa.me/?text=https%3A%2F%2Fexample.com%2Fblog%2Fa%26b%3Fc%3Dd%23e.html");
    expect(html).not.toContain("a&amp;b");
  });

  it("names its links in the site's language, the networks by their own names", () => {
    const html = render({ pageAddress: ADDRESS, siteText: siteTextFor("de") });

    expect(html).toContain("Diesen Beitrag teilen");
    expect([...html.matchAll(/>([^<>]+)<\/a>/g)].map((match) => match[1])).toEqual([
      "E-Mail",
      "WhatsApp",
      "Facebook",
      "X",
      "LinkedIn",
    ]);
  });

  it("draws nothing on a page that isn't a post", () => {
    expect(render({ pageAddress: ADDRESS }, false)).toBe("");
  });

  it("draws nothing without the site's web address, and on the canvas says where to add it", () => {
    expect(render({})).toBe("");
    expect(render({ elementHint: (missing) => `[${missing}]` })).toContain("[webAddress]");
  });
});
