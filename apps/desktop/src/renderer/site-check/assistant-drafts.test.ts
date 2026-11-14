// @vitest-environment happy-dom
import type { ImageMeta, MediaId, PageId, SiteDoc } from "@webforge/model";
import type { Finding } from "@webforge/site-check";
import type { ComponentLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createEditorSession } from "../editor/editor-session.js";
import {
  type DraftAsk,
  draftAskFor,
  draftRequestFor,
  keepDraftText,
  mayWrite,
} from "./assistant-drafts.js";

/** A section, a heading, rich text and a photo: what the drafts read text from. */
const library: ComponentLibrary = {
  components: {
    Section: { label: "Section", fields: {}, defaults: {}, render: () => null },
    Heading: {
      label: "Heading",
      fields: { text: { kind: "text", label: "Text" } },
      defaults: {},
      render: () => null,
    },
    Text: {
      label: "Text",
      fields: { text: { kind: "richtext", label: "Text" } },
      defaults: {},
      render: () => null,
    },
    Photo: {
      label: "Photo",
      fields: { image: { kind: "media", label: "Image" } },
      defaults: {},
      render: () => null,
    },
  },
} as ComponentLibrary;

const PHOTO = "loaf" as MediaId;

/** A bakery's home page: a section with a heading, text and a photo, and a hidden section. */
function bakery(): { site: SiteDoc; home: PageId } {
  const site = starterSite({ name: "Rise Bakery" });
  const home = site.homePageId;
  const page = site.pages[home];
  if (page === undefined) throw new Error("no home page");
  page.doc.content = [
    {
      type: "Section",
      props: {
        id: "bread",
        content: [
          { type: "Heading", props: { id: "title", text: "Our bread" } },
          {
            type: "Text",
            props: { id: "about", text: "<p>Sourdough &amp; rye, <b>baked</b> daily.</p>" },
          },
          { type: "Photo", props: { id: "photo", image: { mediaId: PHOTO } } },
        ],
      },
    },
    {
      type: "Section",
      props: {
        id: "hidden",
        hidden: true,
        content: [{ type: "Heading", props: { id: "secret", text: "Not shown" } }],
      },
    },
  ];
  site.media[PHOTO] = {
    id: PHOTO,
    kind: "image",
    hash: "a".repeat(64),
    name: "loaf",
    fileName: "sourdough-loaf.jpg",
    mimeType: "image/jpeg",
    width: 800,
    height: 600,
    alt: "",
  } as ImageMeta;
  return { site, home };
}

const altFinding = (home: PageId): Finding => ({
  key: `${home}/photo/image`,
  place: { kind: "element", on: home, nodeId: "photo" },
  values: { image: "sourdough-loaf.jpg", mediaId: PHOTO },
});

describe("Site Check's drafts by the assistant (#873)", () => {
  it("offers to write a missing description or alt text, and nothing else", () => {
    const { site, home } = bakery();
    const description: Finding = { key: home, place: { kind: "page", pageId: home } };
    expect(mayWrite("pageDescriptions", description)).toBe(true);
    expect(mayWrite("altText", altFinding(home))).toBe(true);
    expect(mayWrite("pageTitles", description)).toBe(false);
    expect(mayWrite("altText", { ...altFinding(home), values: { image: "x.jpg" } })).toBe(false);

    expect(draftAskFor("pageDescriptions", description, site)).toEqual({
      kind: "description",
      pageId: home,
    });
    expect(draftAskFor("altText", altFinding(home), site)).toMatchObject({
      kind: "alt",
      mediaId: PHOTO,
    });
  });

  it("writes a description from the page's text as visitors read it, not its hidden parts", () => {
    const { site, home } = bakery();
    const ask: DraftAsk = { kind: "description", pageId: home };
    expect(draftRequestFor(ask, site, library)).toEqual({
      kind: "description",
      language: "en",
      site: "Rise Bakery",
      page: { title: "Rise Bakery", text: "Our bread\nSourdough & rye, baked daily." },
    });
  });

  it("writes alt text from the file's name and the section's text, never the image", () => {
    const { site, home } = bakery();
    const ask = draftAskFor("altText", altFinding(home), site);
    expect(ask).toBeDefined();
    const request = draftRequestFor(ask as DraftAsk, site, library);
    expect(request).toMatchObject({
      kind: "alt",
      language: "en",
      fileName: "sourdough-loaf.jpg",
      nearby: "Our bread\nSourdough & rye, baked daily.",
    });
    expect(Object.keys(request ?? {}).sort()).toEqual([
      "fileName",
      "kind",
      "language",
      "nearby",
      "page",
    ]);
  });

  it("keeps what the person used as one undo step labelled as the assistant's", () => {
    const { site, home } = bakery();
    const session = createEditorSession(library, site);
    keepDraftText(session, { kind: "description", pageId: home }, site, "Fresh sourdough daily.");
    const ask = draftAskFor("altText", altFinding(home), site) as DraftAsk;
    keepDraftText(session, ask, site, "A sourdough loaf on a board");

    const after = session.history.document.getState();
    expect(after.pages[home]?.settings.description).toBe("Fresh sourdough daily.");
    expect(after.media[PHOTO]).toMatchObject({ alt: "A sourdough loaf on a board" });
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "AI (Assistant): Wrote the description of Rise Bakery",
      "AI (Assistant): Edited alt text of sourdough-loaf.jpg",
    ]);
    session.history.undo();
    expect(session.history.document.getState().media[PHOTO]).toMatchObject({ alt: "" });
  });
});
