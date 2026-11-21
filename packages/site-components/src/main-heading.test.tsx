import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import { type HeadingKind, mainHeadingsOf, pageHeadings } from "./main-heading.js";
import { renderNodesToHtml, renderPage } from "./render-static.js";

/** `<h1>` start tags in `html`. */
const h1s = (html: string) => html.match(/<h1[\s>]/gi)?.length ?? 0;

describe("a component's main heading (#982)", () => {
  it("is what its definition says, for every component in every choice of its options", () => {
    let id = 0;
    for (const [type, def] of Object.entries(siteLibrary.components)) {
      // Its text in words and its own HTML a heading, so a heading it writes has something in it.
      const base: NodeDoc["props"] = { ...structuredClone(def.defaults), id: "" };
      for (const [name, field] of Object.entries(def.fields)) {
        if (field.kind === "text" || field.kind === "richtext") base[name] = "Rosa's Bakery";
        if (field.kind === "code") base[name] = "<h1>Prices</h1>";
      }
      const choices = Object.entries(def.fields).flatMap(([name, field]) =>
        // Its own options: the Appearance group and the deeper ones draw no heading of their own.
        field.kind === "select" && field.optionGroup === undefined && !name.startsWith("look")
          ? field.options.map((option) => ({ [name]: option.value }))
          : [],
      );
      for (const choice of [{}, ...choices]) {
        const props = { ...base, ...choice, id: `n${id++}` };
        const html = renderNodesToHtml([{ type, props }], siteLibrary, EDITOR_RENDER_CONTEXT);
        expect(mainHeadingsOf(def.mainHeading, props), `${type} ${JSON.stringify(choice)}`).toBe(
          h1s(html),
        );
      }
    }
    // Some 60 components, each in each of its own options: a few hundred renders.
  }, 60_000);

  it("counts a field's words, its HTML's headings, and nothing while `when` doesn't hold", () => {
    const heading = { field: "text", when: { size: "large" } };
    expect(mainHeadingsOf(heading, { text: "Menu", size: "large" })).toBe(1);
    expect(mainHeadingsOf(heading, { text: "Menu", size: "medium" })).toBe(0);
    expect(mainHeadingsOf(heading, { text: "<br>", size: "large" })).toBe(0);
    const code = { field: "code", html: true } as const;
    expect(mainHeadingsOf(code, { code: "<h1>A</h1><H1 class='x'>B</H1><h10>" })).toBe(2);
    expect(mainHeadingsOf(code, { code: 3 })).toBe(0);
    expect(mainHeadingsOf(undefined, { text: "Menu" })).toBe(0);
  });
});

/** A node of `type` with `props`, its id `id`. */
const node = (type: string, id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type,
  props: { ...props, id },
});

/** The kinds the rule's tests know: a Hero, a Heading, a titled section and an untitled one. */
const KINDS: Readonly<Record<string, HeadingKind>> = {
  Hero: { mainHeading: { field: "title" } },
  Heading: { mainHeading: { field: "text", when: { size: "large" } } },
  TextSection: { titleField: "title" },
  Section: {},
};
const kindOf = (type: string) => KINDS[type];

describe("a page's main heading (#1173)", () => {
  const hero = node("Hero", "hero", { title: "Fresh bread" });
  const story = node("TextSection", "story", { title: "Our story" });
  const menu = node("TextSection", "menu", { title: "What we serve" });

  it("is its own where it has one: a Hero, or a large Heading at any depth", () => {
    expect(pageHeadings([[], [hero, story], []], kindOf)).toEqual({ own: 1, promoted: undefined });
    const large = node("Section", "s", {
      content: [node("Heading", "h", { text: "Menu", size: "large" })],
    });
    expect(pageHeadings([[], [story, large], []], kindOf)).toEqual({ own: 1, promoted: undefined });
  });

  it("is the first section title where it has none of its own, a later one where the first has none", () => {
    expect(pageHeadings([[], [story, menu], []], kindOf)).toEqual({ own: 0, promoted: "story" });
    const untitled = node("TextSection", "untitled", { title: "<br>" });
    const medium = node("Section", "s", {
      content: [node("Heading", "h", { text: "Menu", size: "medium" })],
    });
    expect(pageHeadings([[], [medium, untitled, menu], []], kindOf)).toEqual({
      own: 0,
      promoted: "menu",
    });
  });

  it("leaves out hidden ones, its own and titled sections alike", () => {
    const hidden = (doc: NodeDoc) => ({ ...doc, props: { ...doc.props, hidden: true } });
    expect(pageHeadings([[], [hidden(hero), hidden(story), menu], []], kindOf)).toEqual({
      own: 0,
      promoted: "menu",
    });
  });

  it("looks in the Header, the content and the Footer, in that order", () => {
    // A post's Blog design, drawn in the Header's region on the canvas, comes first.
    const design = node("TextSection", "design", { title: "From the blog" });
    expect(pageHeadings([[design], [story], []], kindOf).promoted).toBe("design");
    expect(pageHeadings([[], [], [story]], kindOf).promoted).toBe("story");
    expect(pageHeadings([[], [], [hero]], kindOf)).toEqual({ own: 1, promoted: undefined });
  });

  it("is none on an empty page, or one with no title anywhere", () => {
    expect(pageHeadings([[], [], []], kindOf)).toEqual({ own: 0, promoted: undefined });
    const untitled = node("Section", "s", { content: [] });
    expect(pageHeadings([[], [untitled], []], kindOf)).toEqual({ own: 0, promoted: undefined });
  });
});

describe("a section's title as the page's main heading (#1173)", () => {
  it("is an h1 in a section title's look, for every section with a title field", () => {
    const titled = Object.entries(siteLibrary.components).filter(
      ([, def]) => def.titleField !== undefined,
    );
    expect(titled.length).toBeGreaterThan(15);
    for (const [type, def] of titled) {
      const props = {
        ...structuredClone(def.defaults),
        id: "titled",
        [def.titleField ?? ""]: "Our story",
      };
      const doc = { type, props };
      const promoted = renderNodesToHtml([doc], siteLibrary, {
        ...EDITOR_RENDER_CONTEXT,
        pageHeading: "titled",
      });
      const plain = renderNodesToHtml([doc], siteLibrary, EDITOR_RENDER_CONTEXT);
      expect(h1s(promoted), type).toBe(1);
      expect(promoted, type).toMatch(/<h1 class="font-heading text-h2[^"]*">Our story<\/h1>/);
      // Only the tag changes.
      expect(promoted.replace(/<(\/?)h1/g, "<$1h2"), type).toBe(plain);
    }
  });

  it("is only the first section's: later sections and smaller titles keep their levels", () => {
    const features = {
      type: "Features",
      props: {
        ...structuredClone(siteLibrary.components.Features?.defaults ?? {}),
        id: "features",
        title: "Why people come back",
      },
    };
    const story = { type: "TextSection", props: { id: "story", title: "Our story" } };
    const { main } = renderPage(
      { header: [], content: [features, story], footer: [] },
      siteLibrary,
      EDITOR_RENDER_CONTEXT,
    );
    expect(main.match(/<h1[^>]*>[^<]*<\/h1>/g)).toEqual([
      '<h1 class="font-heading text-h2">Why people come back</h1>',
    ]);
    expect(main).toContain(">Our story</h2>");
    // The Features' own items keep their small titles.
    expect(main).toMatch(/<h3 class="font-heading text-h3">/);
  });

  it("is none on a page with a Hero, whose title is its main heading", () => {
    const hero = {
      type: "Hero",
      props: { ...structuredClone(siteLibrary.components.Hero?.defaults ?? {}), id: "hero" },
    };
    const story = { type: "TextSection", props: { id: "story", title: "Our story" } };
    const { main } = renderPage(
      { header: [], content: [hero, story], footer: [] },
      siteLibrary,
      EDITOR_RENDER_CONTEXT,
    );
    expect(h1s(main)).toBe(1);
    expect(main).toContain(">Our story</h2>");
  });
});
