import {
  copiedNodeId,
  isNodeDoc,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { createEditorSession, currentPage } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import {
  addComponent,
  addItems,
  addSharedCopy,
  addTarget,
  groupItems,
  sharedSectionItems,
  suggestedItems,
  suggestedTypes,
  withFavourites,
} from "./add-items.js";

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
    const of = (place: string) =>
      Object.entries(siteLibrary.components)
        .filter(([, def]) => (def.place ?? "element") === place)
        .map(([type]) => type);
    const sections = addItems(siteLibrary, "sections").map((item) => item.type);
    const elements = addItems(siteLibrary, "elements");

    // Every section and element in the library's order, a family added later's too.
    expect(sections).toEqual(of("section"));
    expect(sections.slice(0, 2)).toEqual(["Section", "Hero"]);
    expect(elements.map((item) => item.type)).toEqual(of("element"));
    expect(elements.slice(0, 2)).toEqual([
      { type: "Heading", label: "Heading", category: "Text" },
      { type: "Text", label: "Text", category: "Text" },
    ]);
    for (const left of ["Header", "Footer", "FaqItem", "CarouselSlide"]) {
      expect([...sections, ...elements.map((item) => item.type)]).not.toContain(left);
    }
  });

  it("finds by name or group, ignoring case, and groups by category", () => {
    const sections = addItems(siteLibrary, "sections");

    const groups = groupItems(sections, "");

    // In the order their first items come, each holding its category's items in order.
    expect(groups.map((group) => group.category)).toEqual([
      ...new Set(sections.map((item) => item.category)),
    ]);
    for (const group of groups) {
      expect(group.items).toEqual(sections.filter((item) => item.category === group.category));
    }
    expect(groups.slice(0, 2)).toEqual([
      { category: "Basic", items: [sections[0]] },
      { category: "Heroes", items: [sections[1]] },
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
    session.select("heading-1");

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

  it("gives every element in what it adds an id of its own, each time (2.9)", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    session.select("heading-1");

    expect(addComponent(session, "Columns")).toBe(true);
    expect(addComponent(session, "Columns")).toBe(true);

    const ids: string[] = [];
    const walk = (nodes: readonly NodeDoc[]) => {
      for (const node of nodes) {
        ids.push(node.props.id);
        for (const value of Object.values(node.props)) {
          if (Array.isArray(value) && value.every(isNodeDoc)) walk(value);
        }
      }
    };
    walk(currentPage(session)?.doc.content ?? []);
    // Two Columns, two columns each, a Text in each column.
    expect(ids.filter((id) => !["section-1", "heading-1", "text-1"].includes(id))).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("column-0");
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

const HOURS = "shared-hours" as SharedSectionId;
const TEAM = "shared-team" as SharedSectionId;

/**
 * A site with two shared sections, and a home page with `content`: by default a Hero, a Section
 * and a linked copy of "Opening hours", whose section holds a Heading and has an anchor.
 */
function sharedSite(
  content: NodeDoc[] = [
    { type: "Hero", props: { id: "hero" } },
    { type: "Section", props: { id: "section", content: [] } },
    { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } },
  ],
): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = content;
  return {
    ...site,
    sharedSections: {
      [TEAM]: {
        id: TEAM,
        name: "Team",
        section: { type: "Section", props: { id: "team", content: [] } },
      },
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: {
          type: "Section",
          props: {
            id: "s",
            advanced: { anchorId: "hours" },
            content: [{ type: "Heading", props: { id: "t", text: "Hours" } }],
          },
        },
      },
    },
  };
}

describe("shared sections in the Add panel (F-ED-23)", () => {
  it("lists the site's shared sections by name, under their own group", () => {
    expect(sharedSectionItems(sharedSite())).toEqual([
      { type: HOURS, label: "Opening hours", category: "Shared sections", sharedSectionId: HOURS },
      { type: TEAM, label: "Team", category: "Shared sections", sharedSectionId: TEAM },
    ]);
    expect(sharedSectionItems(starterSite())).toEqual([]);
  });

  it("adds after a copy, never into it, for anything selected inside the copy", () => {
    const site = sharedSite();
    const content = site.pages[site.homePageId]?.doc.content ?? [];
    const inCopy = copiedNodeId("c1", "t");

    // A section goes after the copy; an element into the nearest section of the page's own.
    expect(addTarget(siteLibrary, content, "Hero", inCopy)).toEqual({
      parentId: null,
      slot: null,
      index: 3,
    });
    expect(addTarget(siteLibrary, content, "Heading", inCopy)).toEqual({
      parentId: "section",
      slot: "content",
      index: 0,
    });
  });

  it("places a linked copy after the selected section, as one step that selects it", () => {
    const session = createEditorSession(siteLibrary, sharedSite());
    const content = () => currentPage(session)?.doc.content ?? [];
    session.select("hero");

    expect(addSharedCopy(session, HOURS)).toBe(true);

    const added = content()[1];
    expect(added).toMatchObject({ type: SHARED_COPY_TYPE, props: { sharedSectionId: HOURS } });
    // The page already shows the section's anchors in copy c1: this copy gets its own.
    expect(added?.props.anchorSuffix).toBe("2");
    expect(session.ui.getState().nodeId).toBe(copiedNodeId(added?.props.id ?? "", "s"));
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "Added a copy of 'Opening hours'",
    ]);
    session.history.undo();
    expect(content().map((node) => node.props.id)).toEqual(["hero", "section", "c1"]);
  });

  it("places a copy at the canvas's +, after a copy whose element is selected, or last", () => {
    const session = createEditorSession(siteLibrary, sharedSite());
    /** The page's top level: each section's type, or the shared section a copy shows. */
    const shown = () =>
      currentPage(session)?.doc.content.map((node) => node.props.sharedSectionId ?? node.type);

    addSharedCopy(session, TEAM, { index: 0 });
    session.select(copiedNodeId("c1", "t"));
    addSharedCopy(session, TEAM);
    session.select(null);
    addSharedCopy(session, TEAM);

    expect(shown()).toEqual([TEAM, "Hero", "Section", HOURS, TEAM, TEAM]);
  });

  it("places nothing for a shared section the site doesn't have", () => {
    const session = createEditorSession(siteLibrary, sharedSite());

    expect(addSharedCopy(session, "shared-gone" as SharedSectionId)).toBe(false);
    expect(session.history.entries()).toEqual([]);
  });
});

describe("withFavourites (F-ED-26, UX-10)", () => {
  it("leads with favourites, then recently used, each kept in its own category too", () => {
    const items = addItems(siteLibrary, "sections");
    const ordered = withFavourites(items, ["Faq", "gone"], ["Hero", "Faq"]);

    expect(ordered.slice(0, 3).map((item) => [item.category, item.type])).toEqual([
      ["Favourites", "Faq"],
      ["Recently used", "Hero"],
      ["Recently used", "Faq"],
    ]);
    expect(ordered.slice(0, 3).every((item) => item.repeat)).toBe(true);
    // A key no item has (a shared section deleted, an element) is left out.
    expect(ordered.slice(3)).toEqual(items);
    expect(withFavourites(items, [], [])).toEqual(items);
  });

  it("finds each item once while searching, in its own group", () => {
    const ordered = withFavourites(addItems(siteLibrary, "sections"), ["Hero"], ["Faq"]);

    expect(groupItems(ordered, "hero").map((group) => group.category)).toEqual(["Heroes"]);
    expect(groupItems(ordered, "favourites").map((group) => group.category)).toEqual([
      "Favourites",
    ]);
    expect(
      groupItems(ordered, "")
        .map((group) => group.category)
        .slice(0, 2),
    ).toEqual(["Favourites", "Recently used"]);
  });
});

describe("the Suggested group (SP-12)", () => {
  const column = (id: string): NodeDoc => ({ type: "Column", props: { id, content: [] } });
  const content: NodeDoc[] = [
    {
      type: "Section",
      props: {
        id: "s",
        content: [
          { type: "Heading", props: { id: "h", text: "Hi" } },
          {
            type: "List",
            props: { id: "list", items: [{ type: "ListItem", props: { id: "li", text: "One" } }] },
          },
          { type: "Columns", props: { id: "two", columns: [column("c1"), column("c2")] } },
          {
            type: "Columns",
            props: { id: "four", columns: ["d1", "d2", "d3", "d4"].map(column) },
          },
        ],
      },
    },
  ];
  const suggested = (id: string | null) => suggestedTypes(siteLibrary, content, id);

  it("suggests what a selected element's slots name as theirs, and what goes beside an item", () => {
    expect(suggested("list")).toEqual(["ListItem"]);
    expect(suggested("li")).toEqual(["ListItem"]);
    expect(suggested("two")).toEqual(["Column"]);
    expect(suggested("c1")).toEqual(["Column"]);
    expect(suggestedItems(siteLibrary, ["ListItem"])).toEqual([
      { type: "ListItem", label: "List item", category: "Suggested", repeat: true },
    ]);
  });

  it("suggests nothing where anything fits, a slot is full, or nothing is selected", () => {
    expect(suggested("s")).toEqual([]);
    expect(suggested("h")).toEqual([]);
    expect(suggested("four")).toEqual([]);
    expect(suggested("d1")).toEqual([]);
    expect(suggested(null)).toEqual([]);
  });

  it("adds no fifth column, and a Column into Columns with room", () => {
    expect(addTarget(siteLibrary, content, "Column", "four")).toBeUndefined();
    expect(addTarget(siteLibrary, content, "Column", "c1")).toEqual({
      parentId: "two",
      slot: "columns",
      index: 1,
    });
  });
});
