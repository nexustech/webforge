// @vitest-environment happy-dom
import { insertPage, newId, type SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createEditorSession } from "../editor/editor-session.js";
import { businessRequest, businessTexts, keepBusinessWords } from "./business-draft.js";

/** The starter site with an About page: a heading, two paragraphs, and a hidden heading. */
function bakery(): SiteDoc {
  const about = newId("page");
  const draft = structuredClone(starterSite({ name: "Rise Bakery" }));
  insertPage(draft, about, "About");
  const page = draft.pages[about];
  if (page === undefined) throw new Error("No About page");
  draft.settings.general.businessType = "food";
  page.doc.content = [
    {
      type: "Section",
      props: {
        id: "story",
        content: [
          { type: "Heading", props: { id: "story-heading", text: "Our story" } },
          {
            type: "Text",
            props: { id: "story-text", text: "<p>Founded in 1990.</p><p>Still baking.</p>" },
          },
          { type: "Heading", props: { id: "draft-heading", text: "Not yet", hidden: true } },
        ],
      },
    },
  ];
  return draft;
}

describe("the quick start's business words (QS-7, #873)", () => {
  it("drafts the home page's texts, then About's, without hidden elements", () => {
    const site = bakery();
    const texts = businessTexts(site, siteLibrary);
    const heading = siteLibrary.components.Heading?.label;
    expect(texts.map((text) => [text.nodeId, text.sample])).toEqual([
      ["heading-1", expect.any(String)],
      ["text-1", expect.any(String)],
      ["story-heading", "Our story"],
      ["story-text", "Founded in 1990.\n\nStill baking."],
    ]);
    expect(texts[2]?.role).toBe(
      `About · ${heading} · ${siteLibrary.components.Heading?.fields.text?.label}`,
    );
  });

  it("asks with the business and each text's role and sample, and nothing else of the site", () => {
    const site = bakery();
    const texts = businessTexts(site, siteLibrary);
    const request = businessRequest(site, "Sourdough in Leeds since 1990.", texts);
    expect(request).toEqual({
      kind: "business",
      language: "en",
      business: {
        name: "Rise Bakery",
        type: "Food and drink",
        about: "Sourdough in Leeds since 1990.",
      },
      texts: texts.map(({ role, sample }) => ({ role, sample })),
    });
  });

  it("keeps the words as one undo step, a paragraph each in rich text, an empty one unchanged", () => {
    const session = createEditorSession(siteLibrary, bakery());
    const site = session.history.document.getState();
    const texts = businessTexts(site, siteLibrary);
    keepBusinessWords(session, texts, [
      "Bread worth the walk",
      "",
      "How we started",
      "Two friends, one oven.\n\nNow a <b>shop</b> on Kirkgate.",
    ]);

    const kept = session.history.document.getState();
    const about = texts[2]?.pageId;
    const story = about === undefined ? [] : (kept.pages[about]?.doc.content ?? []);
    const [section] = story;
    expect(section?.props.content).toMatchObject([
      { props: { text: "How we started" } },
      {
        props: {
          text: "<p>Two friends, one oven.</p><p>Now a &lt;b&gt;shop&lt;/b&gt; on Kirkgate.</p>",
        },
      },
      { props: { text: "Not yet", hidden: true } },
    ]);
    // The text left empty keeps the template's.
    const before = site.pages[site.homePageId]?.doc.content[0]?.props.content;
    const home = kept.pages[kept.homePageId]?.doc.content[0]?.props.content;
    expect(home).toMatchObject([
      { props: { text: "Bread worth the walk" } },
      { props: { text: Array.isArray(before) ? before[1]?.props.text : undefined } },
    ]);
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "AI (Assistant): Wrote the home and About pages' words",
    ]);
    session.history.undo();
    expect(session.history.document.getState()).toEqual(site);
  });
});
