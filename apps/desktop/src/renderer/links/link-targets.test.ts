import {
  copiedNodeId,
  findBrokenLinks,
  type LinkValue,
  type MediaId,
  type NodeDoc,
  type PageId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../editor/starter-site.js";
import { applyAnchor, asLinkFieldChange } from "./link-change.js";
import { describeLink, linkTargets, newAnchorFor, sectionAnchor } from "./link-targets.js";

/**
 * The starter site, its home page holding `content` and its "Page not found" page `other`, with
 * the shared section "Opening hours" (`hours`, given).
 */
function site(content: NodeDoc[], other: NodeDoc[] = [], hours?: NodeDoc): SiteDoc {
  const base = starterSite();
  const pages = { ...base.pages };
  for (const page of Object.values(base.pages)) {
    const nodes = page.id === base.homePageId ? content : other;
    pages[page.id] = { ...page, doc: { root: { props: {} }, content: nodes } };
  }
  const sharedSections =
    hours === undefined ? {} : { [HOURS]: { id: HOURS, name: "Opening hours", section: hours } };
  return { ...base, pages, sharedSections };
}

const HOURS = "shared-hours" as SharedSectionId;

const copy = (id: string, anchorSuffix?: string): NodeDoc => ({
  type: SHARED_COPY_TYPE,
  props: { id, sharedSectionId: HOURS, ...(anchorSuffix === undefined ? {} : { anchorSuffix }) },
});

const hoursSection = (anchorId?: string): NodeDoc => ({
  type: "Section",
  props: {
    id: "s",
    ...(anchorId === undefined ? {} : { advanced: { anchorId } }),
    content: [{ type: "Heading", props: { id: "t", text: "Hours" } }],
  },
});

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

    expect(newAnchorFor(doc, doc.homePageId, "times", "Opening times")).toBe("opening-times");
    expect(newAnchorFor(doc, doc.homePageId, "times", "Our team")).toBe("our-team-2");
    expect(newAnchorFor(doc, doc.homePageId, "times", "2026 prices")).toBe("section-2026-prices");
    expect(newAnchorFor(doc, doc.homePageId, "times", "!!!")).toBe("page");
  });

  it("lists the sections copies of shared sections show, with the ids and anchors they give them", () => {
    const doc = site([copy("c1"), copy("c2", "2"), ...sections], [], hoursSection("hours"));
    const targets = linkTargets(doc, siteLibrary);

    expect(targets[0]?.sections.slice(0, 2)).toEqual([
      { nodeId: copiedNodeId("c1", "s"), label: "Opening hours", anchorId: "hours" },
      { nodeId: copiedNodeId("c2", "s"), label: "Opening hours", anchorId: "hours-2" },
    ]);
    expect(describeLink({ kind: "page", pageId: doc.homePageId, anchor: "hours-2" }, targets)).toBe(
      "My site › Opening hours",
    );
  });

  it("never gives a section an anchor a copy of a shared section already shows", () => {
    const doc = site([copy("c1"), ...sections], [], hoursSection("opening-times"));

    expect(newAnchorFor(doc, doc.homePageId, "times", "Opening times")).toBe("opening-times-2");
  });

  it("gives a section in a copy an anchor free in every copy, and links to this copy's", () => {
    const anchored: NodeDoc = {
      type: "Section",
      props: { id: "x", advanced: { anchorId: "opening-hours" }, content: [] },
    };
    // Home has two copies; the other page a copy, and a section that has `opening-hours`.
    const doc = site([copy("c1"), copy("c2", "2")], [copy("c3"), anchored], hoursSection());
    const home = doc.homePageId;
    const target = linkTargets(doc, siteLibrary)[0]?.sections[1];
    if (target === undefined) throw new Error("no target");

    const { anchor, given } = sectionAnchor(doc, home, target);
    expect(given).toBe("opening-hours-2");
    expect(anchor).toBe("opening-hours-2-2");

    // The anchor goes in the shared section: every copy shows it, the link finds it.
    const draft = structuredClone(doc);
    applyAnchor(draft, doc, { pageId: home, nodeId: target.nodeId, anchorId: given ?? "" });
    expect(draft.sharedSections[HOURS]?.section.props.advanced).toEqual({
      anchorId: "opening-hours-2",
    });
    expect(draft.pages[home]?.doc).toEqual(doc.pages[home]?.doc);
    const linkTo = (to: string): SiteDoc => {
      const link = { kind: "page", pageId: home, anchor: to };
      const footer = [{ type: "Button", props: { id: "b", link } }];
      return { ...draft, layout: { ...draft.layout, footer } };
    };
    expect(findBrokenLinks(linkTo(anchor))).toEqual([]);
    expect(findBrokenLinks(linkTo("opening-hours-3"))).toHaveLength(1);
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
    const doc = site(structuredClone(sections));
    const draft = structuredClone(doc);
    const pageId = doc.homePageId;

    applyAnchor(draft, doc, { pageId, nodeId: "times", anchorId: "opening-times" });
    applyAnchor(draft, doc, { pageId, nodeId: "team", anchorId: "team-2" });

    const content = draft.pages[pageId]?.doc.content;
    expect(content?.[1]?.props.advanced).toEqual({ anchorId: "opening-times" });
    expect(content?.[2]?.props.advanced).toEqual({ anchorId: "our-team" });
  });
});
