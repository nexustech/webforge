import { describe, expect, it } from "vitest";
import type { PageId } from "./ids.js";
import type { LinkValue } from "./link.js";
import {
  rewriteRichTextLinks,
  richTextHref,
  richTextLinkValue,
  richTextPageLinks,
} from "./rich-text-links.js";

const about = "page-about" as PageId;

describe("rich-text links (F-ED-3, F-ED-18)", () => {
  it.each<[LinkValue, string]>([
    [{ kind: "page", pageId: about }, "webforge:page/page-about"],
    [
      { kind: "page", pageId: about, anchor: "opening-times" },
      "webforge:page/page-about#opening-times",
    ],
    [{ kind: "email", address: "rosa@example.com" }, "mailto:rosa@example.com"],
    [
      { kind: "email", address: "rosa@example.com", subject: "Cakes & more" },
      "mailto:rosa@example.com?subject=Cakes%20%26%20more",
    ],
    [{ kind: "phone", number: "+44 1234 567890" }, "tel:+44 1234 567890"],
    [{ kind: "url", href: "https://example.com/menu" }, "https://example.com/menu"],
  ])("stores %o as %s, and reads it back", (link, href) => {
    expect(richTextHref(link)).toBe(href);
    expect(richTextLinkValue({ href, newTab: false })).toEqual(link);
    expect(richTextLinkValue({ href, newTab: true })).toEqual({ ...link, newTab: true });
  });

  it("can't hold a file, and reads no link from an address it doesn't take", () => {
    expect(richTextHref({ kind: "file", mediaId: "media-1" as never })).toBeUndefined();
    for (const href of [
      "javascript:alert(1)",
      "webforge:page/",
      "webforge:page/page-about#Not An Anchor",
      "mailto:not an address",
    ]) {
      expect(richTextLinkValue({ href, newTab: false })).toBeUndefined();
    }
  });

  it("finds the page links in rich text, and points them where the export says", () => {
    const html =
      '<p><a href="webforge:page/page-about">About</a> and ' +
      '<a target="_blank" href="webforge:page/page-menu#cakes">cakes</a>, ' +
      '<a href="https://example.com">web</a>, <a href="webforge:page/bad id">bad</a></p>';

    expect(richTextPageLinks(html)).toEqual([
      { pageId: "page-about" },
      { pageId: "page-menu", anchor: "cakes" },
    ]);
    const paths: Record<string, string> = { "page-about": "about.html" };
    expect(
      rewriteRichTextLinks(html, (link) => {
        const path = paths[link.pageId];
        return path === undefined ? "#" : `${path}${link.anchor ? `#${link.anchor}` : ""}`;
      }),
    ).toBe(
      '<p><a href="about.html">About</a> and <a target="_blank" href="#">cakes</a>, ' +
        '<a href="https://example.com">web</a>, <a href="#">bad</a></p>',
    );
  });
});
