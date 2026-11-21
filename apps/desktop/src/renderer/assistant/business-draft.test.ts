// @vitest-environment happy-dom
import { findNode, insertPage, newId, type SiteDoc } from "@webforge/model";
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

describe("a business draft's examples (#1228, WN-3)", () => {
  /** The words kept as the stand-in model drafted them, with its flags, and what was told. */
  function kept(drafted: string[], examples: boolean[], told: string, words = drafted) {
    const session = createEditorSession(siteLibrary, bakery());
    session.edit("props", "Phone", (draft) => {
      draft.settings.contact.phone = "0113 496 0000";
    });
    const texts = businessTexts(session.history.document.getState(), siteLibrary);
    keepBusinessWords(session, texts, words, { texts: drafted, examples, told });
    const site = session.history.document.getState();
    return (id: string) =>
      findNode(
        Object.values(site.pages).flatMap((page) => page.doc.content),
        (node) => node.props.id === id,
      )?.props.examples;
  }

  it("marks a text the model flagged, or that made a detail up, kept as drafted", () => {
    const marks = kept(
      ["Bread from £2", "Open from 7am, every day", "How we started", "Two friends, one oven."],
      [false, false, true, false],
      "A bakery on Kirkgate since 1990",
    );
    expect(marks("heading-1")).toEqual({ text: true });
    expect(marks("text-1")).toEqual({ text: true });
    expect(marks("story-heading")).toEqual({ text: true });
    expect(marks("story-text")).toBeUndefined();
  });

  it("leaves what the person told it, Site Settings' details and their own words unmarked", () => {
    const drafted = ["Call 0113 496 0000", "Open from 7am", "Since 1990", "Bread from £2"];
    const marks = kept(drafted, [false, false, false, true], "We open at 7am", [
      ...drafted.slice(0, 3),
      // Changed in review: the person's own.
      "Bread from £3",
    ]);
    expect(["heading-1", "text-1", "story-heading", "story-text"].map(marks)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});
