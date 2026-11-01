import { createSite, type NodeDoc, type SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { siteWithCleanRichText, withCleanRichText } from "./stored-rich-text.js";

const HOSTILE = '<p>Hi<script>alert(1)</script><img src="x" onerror="alert(1)"></p>';
const CLEAN = "<p>Hi</p>";

const text = (id: string, html: string): NodeDoc => ({ type: "Text", props: { id, text: html } });
const section = (id: string, content: NodeDoc[]): NodeDoc => ({
  type: "Section",
  props: { id, content },
});

function siteWith(nodes: NodeDoc[], shared?: NodeDoc): SiteDoc {
  const site = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "404",
  });
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("No home page");
  return {
    ...site,
    layout: { ...site.layout, header: [text("head", HOSTILE)], footer: [] },
    pages: { ...site.pages, [home.id]: { ...home, doc: { ...home.doc, content: nodes } } },
    sharedSections:
      shared === undefined
        ? {}
        : ({ "shared-a": { id: "shared-a", name: "Hours", section: shared } } as never),
  };
}

describe("withCleanRichText (S23)", () => {
  it("cleans rich text in elements and their slots, and leaves other fields as they are", () => {
    const heading: NodeDoc = { type: "Heading", props: { id: "h", text: "<b>Prices</b>" } };
    const nodes = [section("s", [heading, text("t", HOSTILE)])];

    const cleaned = withCleanRichText(nodes, siteLibrary);

    expect(cleaned).toEqual([section("s", [heading, text("t", CLEAN)])]);
    // A heading's text is plain text, drawn escaped: kept as it is, the same object.
    expect((cleaned[0]!.props.content as NodeDoc[])[0]).toBe(heading);
    expect(nodes[0]).toEqual(section("s", [heading, text("t", HOSTILE)]));
  });

  it("gives back the same nodes when nothing needs cleaning", () => {
    const nodes = [section("s", [text("t", '<p><a href="webforge:page/page-a">About</a></p>')])];
    expect(withCleanRichText(nodes, siteLibrary)).toBe(nodes);
  });

  it("leaves an element it doesn't know as it is", () => {
    const nodes: NodeDoc[] = [{ type: "Gone", props: { id: "g", text: HOSTILE } }];
    expect(withCleanRichText(nodes, siteLibrary)).toBe(nodes);
  });
});

describe("siteWithCleanRichText (S23)", () => {
  it("cleans the pages, the Header and Footer, and the shared sections", () => {
    const site = siteWith([text("t", HOSTILE)], section("shared", [text("st", HOSTILE)]));

    const cleaned = siteWithCleanRichText(site, siteLibrary);

    expect(cleaned.layout.header).toEqual([text("head", CLEAN)]);
    expect(cleaned.pages[site.homePageId]?.doc.content).toEqual([text("t", CLEAN)]);
    expect(cleaned.sharedSections["shared-a" as never]?.section).toEqual(
      section("shared", [text("st", CLEAN)]),
    );
    // What needed nothing keeps its objects, so autosave writes only what was cleaned.
    expect(cleaned.layout.footer).toBe(site.layout.footer);
    const notFound = Object.values(site.pages).find((page) => page.kind === "not-found");
    expect(notFound && cleaned.pages[notFound.id]).toBe(notFound);
    expect(cleaned.theme).toBe(site.theme);
  });

  it("gives back the same site when nothing needs cleaning", () => {
    const site = siteWith([text("t", CLEAN)]);
    const clean = { ...site, layout: { ...site.layout, header: [] } };
    expect(siteWithCleanRichText(clean, siteLibrary)).toBe(clean);
  });
});
