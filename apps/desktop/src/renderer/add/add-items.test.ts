import type { NodeDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { createEditorSession, currentPage } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { addComponent, addItems, addTarget, groupItems } from "./add-items.js";

/** A page: a Hero, then a Section holding a Heading and an FAQ with one question. */
const PAGE: NodeDoc[] = [
  { type: "Hero", props: { id: "hero" } },
  {
    type: "Section",
    props: {
      id: "section",
      content: [
        { type: "Heading", props: { id: "heading" } },
        {
          type: "Faq",
          props: { id: "faq", items: [{ type: "FaqItem", props: { id: "question" } }] },
        },
      ],
    },
  },
];

const target = (type: string, selected: string | null, point?: { index: number }) =>
  addTarget(siteLibrary, PAGE, type, selected, point);

describe("addItems (F-ED-1, ADR 0005)", () => {
  it("offers sections and elements, never the Header, Footer or an FAQ's questions", () => {
    expect(addItems(siteLibrary, "sections").map((item) => item.type)).toEqual([
      "Section",
      "Hero",
      "Faq",
    ]);
    expect(addItems(siteLibrary, "elements")).toEqual([
      { type: "Heading", label: "Heading", category: "Text" },
      { type: "Text", label: "Text", category: "Text" },
    ]);
  });

  it("finds by name or group, ignoring case, and groups by category", () => {
    const sections = addItems(siteLibrary, "sections");

    expect(groupItems(sections, "")).toEqual([
      { category: "Basic", items: [sections[0]] },
      { category: "Heroes", items: [sections[1]] },
      { category: "Questions and answers", items: [sections[2]] },
    ]);
    expect(groupItems(sections, "  QUESTIONS ").map((group) => group.category)).toEqual([
      "Questions and answers",
    ]);
    expect(groupItems(sections, "pricing")).toEqual([]);
  });
});

describe("addTarget", () => {
  it("puts a section at the + button's place, after the selection's section, or at the end", () => {
    expect(target("Hero", "heading", { index: 0 })).toEqual({
      parentId: null,
      slot: null,
      index: 0,
    });
    expect(target("Hero", null, { index: 9 })?.index).toBe(2);
    expect(target("Hero", "hero")?.index).toBe(1);
    expect(target("Hero", "question")?.index).toBe(2);
    expect(target("Hero", null)?.index).toBe(2);
  });

  it("puts an element into the selected section, or after the selected element", () => {
    expect(target("Text", "section")).toEqual({ parentId: "section", slot: "content", index: 2 });
    expect(target("Text", "heading")).toEqual({ parentId: "section", slot: "content", index: 1 });
    // A question takes no Text, nor does the FAQ's list: after the FAQ, in the Section.
    expect(target("Text", "question")).toEqual({
      parentId: "section",
      slot: "content",
      index: 2,
    });
  });

  it("falls back to the nearest section that takes it, or nowhere", () => {
    // The Hero has no room for elements: the Section after it.
    expect(target("Text", "hero")?.parentId).toBe("section");
    expect(target("Text", null)?.parentId).toBe("section");
    expect(addTarget(siteLibrary, [PAGE[0] as NodeDoc], "Text", null)).toBeUndefined();
    expect(addTarget(siteLibrary, [], "Text", null)).toBeUndefined();
  });
});

/** A session on the starter site, with the home page's content replaced by `content`. */
function sessionWith(content: NodeDoc[]) {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = content;
  return createEditorSession(siteLibrary, site);
}

describe("addComponent", () => {
  it("adds with its defaults as one 'Added …' step that selects it, undone in one go", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const content = () => currentPage(session)?.doc.content ?? [];
    session.ui.setState({ nodeId: "heading-1" });

    expect(addComponent(session, "Text")).toBe(true);
    expect(addComponent(session, "Hero", { index: 0 })).toBe(true);

    const [hero, section] = content();
    const added = (section?.props.content as NodeDoc[] | undefined)?.[1];
    expect(hero?.type).toBe("Hero");
    expect(added).toMatchObject({ type: "Text", props: siteLibrary.components.Text?.defaults });
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "Added Text",
      "Added Hero",
    ]);
    expect(session.ui.getState().nodeId).toBe(hero?.props.id);
    session.history.undo();
    expect(content()).toHaveLength(1);
  });

  it("adds nothing where nothing takes it, or for an unknown component", () => {
    const session = sessionWith([]);

    expect(addComponent(session, "Text")).toBe(false);
    expect(addComponent(session, "Nothing")).toBe(false);
    expect(session.history.entries()).toEqual([]);
  });

  it("starts a slot the parent doesn't have yet", () => {
    const session = sessionWith([{ type: "Section", props: { id: "s" } }]);

    addComponent(session, "Heading");

    expect(currentPage(session)?.doc.content[0]?.props.content).toMatchObject([
      { type: "Heading" },
    ]);
  });
});
