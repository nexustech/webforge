import {
  insertPage,
  type NodeDoc,
  newId,
  type PageId,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { SiteWideAction } from "../shell/confirm-site-wide.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  type FindActions,
  groupName,
  replaceAll,
  replaceOne,
  showSpot,
  spotName,
} from "./find-actions.js";
import type { FindOptions, TextSpot } from "./find-text.js";

const SMITH: FindOptions = { query: "Smith", matchCase: false, wholeWords: false };

const heading = (id: string, text: string): NodeDoc => ({ type: "Heading", props: { id, text } });

/** A site with Smith on two pages and in a shared section placed on both, and its session. */
function setUp(edit?: (draft: SiteDoc, about: PageId, shared: SharedSectionId) => void) {
  const about = newId("page");
  const shared = newId("sharedSection");
  const site = structuredClone(starterSite());
  insertPage(site, about, "About");
  const home = site.pages[site.homePageId];
  const aboutPage = site.pages[about];
  if (home === undefined || aboutPage === undefined) throw new Error("No pages");
  home.doc.content = [
    heading("hello", "Smith & Sons"),
    { type: "SharedSectionCopy", props: { id: "copy-home", sharedSectionId: shared } },
  ];
  aboutPage.doc.content = [
    heading("story", "Ask Smith"),
    { type: "SharedSectionCopy", props: { id: "copy-about", sharedSectionId: shared } },
  ];
  site.sharedSections[shared] = {
    id: shared,
    name: "Opening times",
    section: {
      type: "Section",
      props: { id: "hours", content: [heading("hours-title", "Smith")] },
    },
  };
  edit?.(site, about, shared);
  const session = sessionWith(site);
  const asked: SiteWideAction[] = [];
  const answer = { yes: true };
  const actions: FindActions = {
    session,
    panels: { show: vi.fn() },
    settings: { show: vi.fn(async () => true) },
    commands: { run: vi.fn(() => true) },
    siteWide: {
      confirmSiteWide: async (action) => {
        asked.push(action);
        return answer.yes;
      },
    },
  };
  const labels = () => session.history.entries().map((entry) => entry.label);
  const doc = () => session.history.document.getState();
  return { session, actions, asked, answer, labels, doc, home: site.homePageId, about, shared };
}

describe("replaceAll", () => {
  it("replaces every match, after asking, as one labelled undo step", async () => {
    const { actions, asked, labels, doc, session, home, about, shared } = setUp();

    expect(await replaceAll(actions, SMITH, "Smyth")).toBe(3);

    expect(asked).toEqual([
      expect.objectContaining({
        action: "Replace 'Smith' with 'Smyth' everywhere?",
        confirm: "Replace All",
        affectedPages: 2,
      }),
    ]);
    expect(labels()).toEqual(["Replaced 'Smith' with 'Smyth' in 3 places"]);
    expect(doc().pages[home]?.doc.content[0]?.props.text).toBe("Smyth & Sons");
    expect(doc().pages[about]?.doc.content[0]?.props.text).toBe("Ask Smyth");
    // The shared section once, for both its copies.
    expect(doc().sharedSections[shared]?.section.props.content).toEqual([
      heading("hours-title", "Smyth"),
    ]);

    session.history.undo();
    expect(doc().pages[home]?.doc.content[0]?.props.text).toBe("Smith & Sons");
    expect(doc().pages[about]?.doc.content[0]?.props.text).toBe("Ask Smith");
    expect(doc().sharedSections[shared]?.section.props.content).toEqual([
      heading("hours-title", "Smith"),
    ]);
  });

  it("changes nothing when the question is cancelled, or nothing is found", async () => {
    const { actions, answer, labels } = setUp();
    answer.yes = false;

    expect(await replaceAll(actions, SMITH, "Smyth")).toBe(0);
    expect(await replaceAll(actions, { ...SMITH, query: "Jones" }, "Smyth")).toBe(0);
    expect(labels()).toEqual([]);
  });

  it("asks nothing for a change to one page only", async () => {
    const { actions, asked, labels } = setUp();

    await replaceAll(actions, { ...SMITH, query: "Sons" }, "Daughters");

    expect(asked).toEqual([]);
    expect(labels()).toEqual(["Replaced 'Sons' with 'Daughters' in 1 place"]);
  });

  it("counts every page for a change to the Header, which every page shows", async () => {
    const { actions, asked } = setUp((site) => {
      site.layout.header = [{ type: "Header", props: { id: "header", siteName: "Sons Ltd" } }];
    });

    await replaceAll(actions, { ...SMITH, query: "Sons" }, "Daughters");

    expect(asked[0]?.affectedPages).toBe(3);
  });
});

describe("replaceOne", () => {
  it("replaces that match only, as an undo step named after it", () => {
    const { session, labels, doc, about } = setUp((site, page) => {
      const node = site.pages[page]?.doc.content[0];
      if (node !== undefined) node.props.text = "Smith and Smith";
    });
    const spot: TextSpot = {
      kind: "element",
      on: about,
      nodeId: "story",
      type: "Heading",
      field: "text",
    };

    replaceOne(session, SMITH, "Smyth", spot, 1);

    expect(doc().pages[about]?.doc.content[0]?.props.text).toBe("Smith and Smyth");
    expect(labels()).toEqual(["Replaced 'Smith' with 'Smyth'"]);
  });

  it("shortens long text in its label", () => {
    const { session, labels, home } = setUp();
    const spot: TextSpot = { kind: "page", pageId: home, field: "title" };

    replaceOne(session, { ...SMITH, query: "e" }, "x".repeat(60), spot, 0);

    expect(labels()[0]).toBe(`Replaced 'e' with '${"x".repeat(39)}…'`);
  });
});

describe("showSpot", () => {
  it("selects an element on its page, and a shared section's in a copy on the page shown", () => {
    const { actions, session, about, shared } = setUp();

    showSpot(
      { kind: "element", on: about, nodeId: "story", type: "Heading", field: "text" },
      actions,
    );
    expect(session.ui.getState().pageId).toBe(about);
    expect(session.ui.getState().nodeId).toBe("story");

    showSpot(
      { kind: "element", on: shared, nodeId: "hours-title", type: "Heading", field: "text" },
      actions,
    );
    expect(session.ui.getState().pageId).toBe(about);
    expect(session.ui.getState().nodeId).toBe("copy-about~hours-title");
  });

  it("selects the Header's elements on the page shown", () => {
    const { actions, session, home } = setUp();

    showSpot(
      { kind: "element", on: "header", nodeId: "header", type: "Header", field: "siteName" },
      actions,
    );

    expect(session.ui.getState().pageId).toBe(home);
    expect(session.ui.getState().nodeId).toBe("header");
  });

  it("opens Page Settings for a title, the Pages panel for a name in the menu", () => {
    const { actions, session, about } = setUp();

    showSpot({ kind: "page", pageId: about, field: "title" }, actions);
    expect(session.ui.getState().pageId).toBe(about);
    expect(actions.commands.run).toHaveBeenCalledWith(COMMAND_IDS.pageSettings);

    showSpot({ kind: "page", pageId: about, field: "navLabel" }, actions);
    expect(actions.panels.show).toHaveBeenCalledWith("site");
  });

  it("opens Site Settings at the business details' section", () => {
    const { actions } = setUp();

    showSpot({ kind: "settings", field: "general.name" }, actions);
    showSpot({ kind: "settings", field: "contact.address" }, actions);

    expect(vi.mocked(actions.settings.show).mock.calls).toEqual([
      ["site", "general"],
      ["site", "contact"],
    ]);
  });
});

describe("naming what was found", () => {
  it("names each place a match is listed under", () => {
    const { doc, home, shared } = setUp();

    expect(groupName(doc(), home)).toBe(doc().pages[home]?.title);
    expect(groupName(doc(), "header")).toBe("Header");
    expect(groupName(doc(), "footer")).toBe("Footer");
    expect(groupName(doc(), "settings")).toBe("Site Settings");
    expect(groupName(doc(), shared)).toBe("Shared section 'Opening times'");
  });

  it("names what a match is in: the element and its field, or the setting", () => {
    const { doc, home, about } = setUp((site, page) => {
      const node = site.pages[page]?.doc.content[0];
      if (node !== undefined) node.props.layerName = "Our story";
    });

    expect(
      spotName(doc(), siteLibrary, {
        kind: "element",
        on: home,
        nodeId: "hello",
        type: "Heading",
        field: "text",
      }),
    ).toBe("Heading · Text");
    expect(
      spotName(doc(), siteLibrary, {
        kind: "element",
        on: about,
        nodeId: "story",
        type: "Heading",
        field: "text",
      }),
    ).toBe("Our story · Text");
    expect(spotName(doc(), siteLibrary, { kind: "page", pageId: home, field: "title" })).toBe(
      "Title",
    );
    expect(spotName(doc(), siteLibrary, { kind: "settings", field: "contact.businessName" })).toBe(
      "Business name",
    );
  });
});
