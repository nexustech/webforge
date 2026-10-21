import { type PageId, pagePath, type SiteDoc, siteDocSchema } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createEditorSession, type EditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import {
  addPage,
  canDelete,
  deletePage,
  duplicatePage,
  fileNameFor,
  fileNameInFolder,
  foldersOf,
  movePage,
  moveToFolder,
  renamePage,
  setHiddenFromNavigation,
  setHomePage,
} from "./page-actions.js";

function setUp() {
  const session = createEditorSession(siteLibrary, starterSite());
  const site = () => session.history.document.getState();
  const home = site().homePageId;
  const notFound = site().pageOrder.find((id) => site().pages[id]?.kind === "not-found");
  if (notFound === undefined) throw new Error("no 'Page not found' page");
  const add = (name: string) => {
    const id = addPage(session, name);
    if (id === null) throw new Error("not added");
    return id;
  };
  const labels = () => session.history.entries().map((entry) => entry.label);
  const titles = () => site().pageOrder.map((id) => site().pages[id]?.title);
  const shown = () => session.ui.getState().pageId;
  return { session, site, home, notFound, add, labels, titles, shown };
}

/** The menu's page items, as page titles. */
const menuTitles = (site: SiteDoc) =>
  site.menu.items.map((item) =>
    item.kind === "page" ? site.pages[item.pageId]?.title : item.kind,
  );

describe("page actions (F-ED-13)", () => {
  it("adds a page before 'Page not found', shows it and adds it to the menu", () => {
    const { session, site, add, labels, titles, shown } = setUp();

    const id = add("  About us ");

    expect(titles()).toEqual(["My site", "About us", "Page not found"]);
    expect(site().pages[id]).toMatchObject({ kind: "page", slug: "about-us", title: "About us" });
    expect(shown()).toBe(id);
    expect(menuTitles(site())).toEqual(["My site", "About us"]);
    expect(labels()).toEqual(["Added page 'About us'"]);

    session.history.undo();
    expect(site().pages[id]).toBeUndefined();
    expect(shown()).toBe(site().homePageId);
    session.history.redo();
    expect(shown()).toBe(id);
    expect(addPage(session, "   ")).toBeNull();
  });

  it("gives every page a unique, valid file name", () => {
    const { site, add } = setUp();
    add("About");
    add("About");
    add("Index");
    add("404");

    expect(siteDocSchema.safeParse(site()).success).toBe(true);
    expect(
      site().pageOrder.map((id) => pagePath(site().pages[id] as never, site().homePageId)),
    ).toEqual(["index", "about", "about-2", "index-2", "404-2", "404"]);
  });

  it("renames a page and its file", () => {
    const { session, site, add, labels } = setUp();
    const about = add("About");
    add("Team");

    renamePage(session, about, "Team");
    renamePage(session, about, "Team");
    renamePage(session, about, " ");

    expect(site().pages[about]).toMatchObject({ title: "Team", slug: "team-2" });
    expect(labels().at(-1)).toBe("Renamed page 'Team'");
    expect(labels()).toHaveLength(3);
  });

  it("duplicates a page after itself, as an ordinary top-level page", () => {
    const { session, site, home, notFound, titles, shown, labels } = setUp();

    const copy = duplicatePage(session, home);

    expect(titles()).toEqual(["My site", "My site (copy)", "Page not found"]);
    expect(copy).not.toBeNull();
    expect(site().pages[copy as PageId]).toMatchObject({ kind: "page", slug: "my-site-copy" });
    expect(site().pages[copy as PageId]?.doc).toEqual(site().pages[home]?.doc);
    expect(shown()).toBe(copy);
    expect(labels()).toEqual(["Duplicated page 'My site'"]);
    expect(duplicatePage(session, notFound)).toBeNull();
  });

  it("moves pages up and down within their folder", () => {
    const { session, site, add, titles, labels } = setUp();
    const about = add("About");
    const team = add("Team");
    moveToFolder(session, team, "Company");
    const contact = add("Contact");
    moveToFolder(session, contact, "Company");

    movePage(session, about, -1);
    expect(titles()).toEqual(["About", "My site", "Team", "Contact", "Page not found"]);
    expect(labels().at(-1)).toBe("Moved page 'About'");
    movePage(session, team, 1);
    expect(titles()).toEqual(["About", "My site", "Contact", "Team", "Page not found"]);
    const count = labels().length;
    movePage(session, about, -1);
    movePage(session, team, 1);
    expect(labels()).toHaveLength(count);
    expect(menuTitles(site())).toEqual(["About", "My site", "Contact", "Team"]);
  });

  it("moves a page into a folder and out again, renaming it only on a clash", () => {
    const { session, site, home, notFound, add } = setUp();
    const about = add("About");
    const other = add("Other");
    moveToFolder(session, other, "Our Company");
    renamePage(session, other, "About");

    expect(fileNameInFolder(site(), about, "Our Company")).toBe("our-company/about-2.html");
    moveToFolder(session, about, "Our Company");
    expect(site().pages[about]).toMatchObject({ folder: "our-company", slug: "about-2" });
    expect(foldersOf(site())).toEqual(["our-company"]);

    moveToFolder(session, about, undefined);
    expect(site().pages[about]?.folder).toBeUndefined();
    expect(site().pages[about]?.slug).toBe("about-2");

    const count = session.history.entries().length;
    moveToFolder(session, home, "Company");
    moveToFolder(session, notFound, "Company");
    expect(session.history.entries()).toHaveLength(count);
  });

  it("sets the Home page, taking it out of its folder", () => {
    const { session, site, home, notFound, add, labels } = setUp();
    const about = add("About");
    moveToFolder(session, about, "Company");

    setHomePage(session, about);

    expect(site().homePageId).toBe(about);
    expect(site().pages[about]?.folder).toBeUndefined();
    expect(labels().at(-1)).toBe("Set 'About' as Home page");
    expect(canDelete(site(), site().pages[home] as never)).toBe(true);
    setHomePage(session, notFound);
    expect(site().homePageId).toBe(about);
  });

  it("gives the old Home page a valid file name of its own", () => {
    const { session, site, home, add } = setUp();
    const about = add("About");
    // A Home page may use a reserved slug, since it is exported as index.html anyway.
    session.edit("props", "Edited page", (draft) => {
      const page = draft.pages[home];
      if (page !== undefined) page.slug = "index";
    });

    setHomePage(session, about);

    expect(site().pages[home]?.slug).toBe("index-2");
    expect(siteDocSchema.safeParse(site()).success).toBe(true);
  });

  it("moves a page into an existing nested folder as it is", () => {
    const { session, site, add } = setUp();
    const cakes = add("Cakes");
    const bread = add("Bread");
    session.edit("move", "Moved page", (draft) => {
      const page = draft.pages[cakes];
      if (page !== undefined) page.folder = "menu/baked";
    });

    expect(fileNameInFolder(site(), bread, "menu/baked")).toBe("menu/baked/bread.html");
    moveToFolder(session, bread, "menu/baked");

    expect(site().pages[bread]?.folder).toBe("menu/baked");
  });

  it("keeps titles short enough to save, copies included", () => {
    const { session, site, add } = setUp();
    const long = add("x".repeat(250));

    expect(site().pages[long]?.title).toHaveLength(200);
    const copy = duplicatePage(session, long);
    expect(site().pages[copy as PageId]?.title).toHaveLength(200);
    renamePage(session, long, "y".repeat(300));
    expect(site().pages[long]?.title).toBe("y".repeat(200));
    expect(siteDocSchema.safeParse(site()).success).toBe(true);
  });

  it("hides a page from navigation and shows it again, never 'Page not found'", () => {
    const { session, site, add, notFound, labels } = setUp();
    const about = add("About");

    setHiddenFromNavigation(session, about, true);
    setHiddenFromNavigation(session, about, true);
    expect(site().pages[about]?.settings.hideFromNavigation).toBe(true);
    setHiddenFromNavigation(session, about, false);
    setHiddenFromNavigation(session, notFound, false);

    expect(labels().slice(1)).toEqual([
      "Hid 'About' from navigation",
      "Showed 'About' in navigation",
    ]);
    expect(site().pages[notFound]?.settings.hideFromNavigation).toBe(true);
  });

  it("deletes a page, showing the Home page instead, and undo brings it back shown", () => {
    const { session, site, home, add, labels, shown } = setUp();
    const about = add("About");

    deletePage(session, about);

    expect(site().pages[about]).toBeUndefined();
    expect(site().pageOrder).not.toContain(about);
    expect(menuTitles(site())).toEqual(["My site"]);
    expect(shown()).toBe(home);
    expect(labels().at(-1)).toBe("Deleted page 'About'");

    session.history.undo();
    expect(site().pages[about]?.title).toBe("About");
    expect(shown()).toBe(about);
  });

  it("keeps the page shown when deleting another one", () => {
    const { session, add, shown } = setUp();
    const about = add("About");
    const team = add("Team");

    deletePage(session, about);

    expect(shown()).toBe(team);
  });

  it("can't delete the Home page or 'Page not found' (F-ED-20)", () => {
    const { session, site, home, notFound } = setUp();

    deletePage(session, home);
    deletePage(session, notFound);

    expect(Object.keys(site().pages)).toHaveLength(2);
    expect(session.history.entries()).toEqual([]);
  });

  it("removes a deleted page from an edited menu and adds new pages at its end", () => {
    const { session, site, add } = setUp();
    const about = add("About");
    session.edit("props", "Edited menu", (draft) => {
      draft.menu.follows = "custom";
      draft.menu.items.reverse();
      draft.menu.items.push({
        id: "group" as never,
        kind: "group",
        label: "More",
        hidden: false,
        children: [{ id: "child" as never, kind: "page", pageId: about, hidden: false }],
      });
    });

    add("Team");
    expect(menuTitles(site())).toEqual(["About", "My site", "group", "Team"]);
    deletePage(session, about);

    expect(menuTitles(site())).toEqual(["My site", "group", "Team"]);
    const group = site().menu.items[1];
    expect(group?.kind === "group" && group.children).toEqual([]);
  });

  it("names files as the dialogs show them", () => {
    const { session, site, home, notFound, add } = setUp();
    const about = add("About");
    moveToFolder(session, about, "Company");

    expect(fileNameFor(site(), "About", undefined)).toBe("about.html");
    expect(fileNameFor(site(), "About", "company")).toBe("company/about-2.html");
    expect(fileNameFor(site(), "About", "company", about)).toBe("company/about.html");
    expect(fileNameFor(site(), "Welcome", undefined, home)).toBe("index.html");
    expect(fileNameFor(site(), "Oops", undefined, notFound)).toBe("404.html");
  });
});

/** One Pages panel action, picked by index so it works with whatever pages exist. */
type Action = { readonly kind: number; readonly page: number; readonly name: string };

function perform(session: EditorSession, { kind, page, name }: Action): void {
  const order = session.history.document.getState().pageOrder;
  const id = order[page % order.length] as PageId;
  switch (kind) {
    case 0:
      addPage(session, name);
      break;
    case 1:
      renamePage(session, id, name);
      break;
    case 2:
      duplicatePage(session, id);
      break;
    case 3:
      movePage(session, id, page % 2 === 0 ? -1 : 1);
      break;
    case 4:
      moveToFolder(session, id, page % 3 === 0 ? undefined : name);
      break;
    case 5:
      setHomePage(session, id);
      break;
    case 6:
      setHiddenFromNavigation(session, id, page % 2 === 0);
      break;
    default:
      deletePage(session, id);
  }
}

describe("page actions and undo (U8)", () => {
  it("always leave a valid site; undo all returns to the start and redo all to the end", () => {
    const action = fc.record({
      kind: fc.nat({ max: 7 }),
      page: fc.nat({ max: 20 }),
      name: fc.string({ minLength: 1, maxLength: 20 }),
    });
    fc.assert(
      fc.property(fc.array(action, { maxLength: 25 }), (actions) => {
        const session = createEditorSession(siteLibrary, starterSite());
        const start = session.history.document.getState();
        for (const next of actions) {
          perform(session, next);
          expect(siteDocSchema.safeParse(session.history.document.getState()).success).toBe(true);
          expect(
            session.history.document.getState().pages[session.ui.getState().pageId],
          ).toBeDefined();
        }
        const end = session.history.document.getState();

        while (session.history.undo()) {
          // Undo everything.
        }
        expect(session.history.document.getState()).toEqual(start);
        while (session.history.redo()) {
          // Redo everything.
        }
        expect(session.history.document.getState()).toEqual(end);
      }),
      { numRuns: 60 },
    );
  });
});
