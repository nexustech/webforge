import type { LinkValue, MediaId, NodeDoc, PageId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../editor/starter-site.js";
import { applyAnchor, asLinkFieldChange } from "./link-change.js";
import { describeLink, linkTargets, newAnchorFor } from "./link-targets.js";

/** The starter site, its home page holding `content`. */
function site(content: NodeDoc[]) {
  const base = starterSite();
  const home = base.pages[base.homePageId];
  if (home === undefined) throw new Error("no home page");
  return {
    ...base,
    pages: { ...base.pages, [home.id]: { ...home, doc: { root: { props: {} }, content } } },
  };
}

const sections: NodeDoc[] = [
  { type: "Hero", props: { id: "hero", title: "Hi" } },
  { type: "Section", props: { id: "times", layerName: "Opening times", content: [] } },
  {
    type: "Section",
    props: { id: "team", advanced: { anchorId: "our-team" }, content: [] },
  },
];

describe("link targets (F-ED-18)", () => {
  it("lists the pages, each with its sections named as in Layers", () => {
    const targets = linkTargets(site(sections), siteLibrary);

    expect(targets.map((page) => page.title)).toEqual(["My site", "Page not found"]);
    expect(targets[0]?.sections).toEqual([
      { nodeId: "hero", label: "Hero", anchorId: undefined },
      { nodeId: "times", label: "Opening times", anchorId: undefined },
      { nodeId: "team", label: "Section", anchorId: "our-team" },
    ]);
  });

  it("names a new anchor after its section, starting with a letter, unique on the page", () => {
    const doc = site(sections);

    expect(newAnchorFor(doc, doc.homePageId, "Opening times")).toBe("opening-times");
    expect(newAnchorFor(doc, doc.homePageId, "Our team")).toBe("our-team-2");
    expect(newAnchorFor(doc, doc.homePageId, "2026 prices")).toBe("section-2026-prices");
    expect(newAnchorFor(doc, doc.homePageId, "!!!")).toBe("page");
  });

  it("describes a link in a few words", () => {
    const doc = site(sections);
    const targets = linkTargets(doc, siteLibrary);
    const home = doc.homePageId;
    const describe = (link: LinkValue | undefined) => describeLink(link, targets);

    expect(describe(undefined)).toBe("No link");
    expect(describe({ kind: "page", pageId: home })).toBe("My site");
    expect(describe({ kind: "page", pageId: home, anchor: "our-team" })).toBe("My site › Section");
    expect(describe({ kind: "page", pageId: "page-gone" as PageId })).toBe(
      "A page that was deleted",
    );
    expect(describe({ kind: "email", address: "hi@example.com" })).toBe("hi@example.com");
    expect(describe({ kind: "phone", number: "01234 567890" })).toBe("01234 567890");
    expect(describe({ kind: "url", href: "https://example.com" })).toBe("https://example.com");
    // A document by its file name, or one deleted from Media since (1.28).
    const media = {
      ["media-a" as MediaId]: {
        id: "media-a" as MediaId,
        hash: "a".repeat(64),
        name: "prices",
        fileName: "Price list.pdf",
        kind: "file" as const,
        mimeType: "application/pdf" as const,
      },
    };
    expect(describeLink({ kind: "file", mediaId: "media-a" as MediaId }, targets, media)).toBe(
      "Price list.pdf",
    );
    expect(describe({ kind: "file", mediaId: "media-b" as MediaId })).toBe(
      "A file deleted from Media",
    );
  });
});

describe("link changes", () => {
  it("accepts a link, none, or a link with the anchor its section needs", () => {
    const pageId = "page-a" as PageId;

    expect(asLinkFieldChange({ link: undefined })).toEqual({ link: undefined });
    expect(
      asLinkFieldChange({
        link: { kind: "page", pageId, anchor: "times" },
        anchor: { pageId, nodeId: "s", anchorId: "times" },
      }),
    ).toBeDefined();
    expect(asLinkFieldChange({ kind: "page", pageId })).toBeUndefined();
    expect(asLinkFieldChange({ link: { kind: "url", href: "nope" } })).toBeUndefined();
  });

  it("gives a section its anchor, but never renames one it has", () => {
    const page = { root: { props: {} }, content: structuredClone(sections) };
    const draft = structuredClone(page);
    const pageId = "page-a" as PageId;

    applyAnchor(draft, page, { pageId, nodeId: "times", anchorId: "opening-times" });
    applyAnchor(draft, page, { pageId, nodeId: "team", anchorId: "team-2" });

    expect(draft.content[1]?.props.advanced).toEqual({ anchorId: "opening-times" });
    expect(draft.content[2]?.props.advanced).toEqual({ anchorId: "our-team" });
  });
});
