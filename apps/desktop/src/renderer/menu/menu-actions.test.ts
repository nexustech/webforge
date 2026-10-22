import type { MenuItem, MenuItemId, PageId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { addPage } from "../site/page-actions.js";
import {
  addMenuItem,
  editMenuLink,
  followPages,
  itemLabel,
  menuItem,
  moveMenuItem,
  removeMenuItem,
  renameMenuItem,
  setMenuItemHidden,
} from "./menu-actions.js";

function setUp() {
  const session = createEditorSession(siteLibrary, starterSite());
  const site = () => session.history.document.getState();
  const about = addPage(session, "About") as PageId;
  // A section on About to link to.
  session.edit("insert", "Added Section", (draft) => {
    draft.pages[about]?.doc.content.push({
      type: "Section",
      props: { id: "hours", layerName: "Opening hours", content: [] },
    });
  });
  const labels = () => session.history.entries().map((entry) => entry.label);
  /** The menu as "label" rows, dropdown contents indented, hidden ones marked. */
  const rows = (items: readonly MenuItem[] = site().menu.items, indent = ""): string[] =>
    items.flatMap((item) => [
      `${indent}${itemLabel(site(), item)}${item.hidden ? " (hidden)" : ""}`,
      ...(item.kind === "group" ? rows(item.children, "  ") : []),
    ]);
  const idOf = (label: string) => {
    const all = site().menu.items.flatMap((item) =>
      item.kind === "group" ? [item, ...item.children] : [item],
    );
    const found = all.find((item) => itemLabel(site(), item) === label);
    if (found === undefined) throw new Error(`no menu item '${label}'`);
    return found.id;
  };
  return { session, site, about, labels, rows, idOf };
}

describe("menu editor actions (F-ED-17)", () => {
  it("adds links, buttons and dropdowns at the end, each one step, and the menu becomes custom", () => {
    const { session, site, about, labels, rows } = setUp();
    expect(site().menu.follows).toBe("pages");

    addMenuItem(session, {
      kind: "button",
      label: " Book now ",
      change: { link: { kind: "url", href: "https://book.example" } },
    });
    addMenuItem(session, {
      kind: "link",
      label: "Hours",
      change: {
        link: { kind: "page", pageId: about, anchor: "opening-hours" },
        anchor: { pageId: about, nodeId: "hours", anchorId: "opening-hours" },
      },
    });
    addMenuItem(session, { kind: "group", label: "More" });
    expect(addMenuItem(session, { kind: "group", label: "  " })).toBeNull();

    expect(site().menu.follows).toBe("custom");
    expect(rows()).toEqual(["My site", "About", "Book now", "Hours", "More"]);
    // A link to a section is a section item, and the section got its anchor in the same step.
    expect(site().menu.items[3]).toMatchObject({
      kind: "section",
      link: { anchor: "opening-hours" },
    });
    expect(site().pages[about]?.doc.content[0]?.props.advanced).toEqual({
      anchorId: "opening-hours",
    });
    expect(labels().slice(-3)).toEqual([
      "Added menu item 'Book now'",
      "Added menu item 'Hours'",
      "Added menu item 'More'",
    ]);

    session.history.undo();
    session.history.undo();
    expect(site().pages[about]?.doc.content[0]?.props.advanced).toBeUndefined();
  });

  it("renames and hides items without making the menu custom; a page item can take its name back", () => {
    const { session, site, labels, rows, idOf } = setUp();
    const about = idOf("About");

    renameMenuItem(session, about, "Our story");
    setMenuItemHidden(session, about, true);
    // The menu still follows the pages, keeping the name and the hiding.
    expect(site().menu.follows).toBe("pages");
    addPage(session, "Team");
    expect(rows()).toEqual(["My site", "Our story (hidden)", "Team"]);

    renameMenuItem(session, about, "");
    renameMenuItem(session, about, "");
    setMenuItemHidden(session, about, true);
    expect(rows()[1]).toBe("About (hidden)");
    expect(labels()).toContain("Renamed menu item 'About'");
    expect(labels()).toContain("Hid menu item 'Our story'");
    expect(labels().filter((label) => label.startsWith("Renamed"))).toHaveLength(2);
  });

  it("moves items within the menu and into or out of a dropdown, one level deep", () => {
    const { session, site, labels, rows, idOf } = setUp();
    addMenuItem(session, { kind: "group", label: "More" });
    const more = idOf("More");
    const about = idOf("About");

    moveMenuItem(session, about, { group: more, index: 0 });
    moveMenuItem(session, idOf("My site"), { group: null, index: 9 });
    expect(rows()).toEqual(["More", "  About", "My site"]);

    moveMenuItem(session, about, { group: null, index: 0 });
    // A dropdown can't go into a dropdown, and a move to its own place is no step.
    moveMenuItem(session, more, { group: more, index: 0 });
    moveMenuItem(session, about, { group: null, index: 0 });
    expect(rows()).toEqual(["About", "More", "My site"]);
    expect(labels().filter((label) => label.startsWith("Moved"))).toEqual([
      "Moved menu item 'About'",
      "Moved menu item 'My site'",
      "Moved menu item 'About'",
    ]);
    expect(site().menu.follows).toBe("custom");
  });

  it("changes a link's label and target in one step, keeping it hidden", () => {
    const { session, site, about, labels, idOf } = setUp();
    addMenuItem(session, {
      kind: "link",
      label: "Shop",
      change: { link: { kind: "url", href: "https://shop.example" } },
    });
    const shop = idOf("Shop");
    setMenuItemHidden(session, shop, true);

    editMenuLink(session, shop, "Hours", {
      link: { kind: "page", pageId: about, anchor: "opening-hours" },
      anchor: { pageId: about, nodeId: "hours", anchorId: "opening-hours" },
    });

    expect(menuItem(site(), shop)).toMatchObject({ kind: "section", label: "Hours", hidden: true });
    expect(labels().at(-1)).toBe("Changed menu item 'Shop'");
  });

  it("removes items, and follows the page order again on request, all undoable", () => {
    const { session, site, rows, idOf } = setUp();
    addMenuItem(session, { kind: "group", label: "More" });
    moveMenuItem(session, idOf("About"), { group: idOf("More"), index: 0 });
    renameMenuItem(session, idOf("About"), "Our story");

    removeMenuItem(session, idOf("My site"));
    expect(rows()).toEqual(["More", "  Our story"]);
    const custom = site().menu;

    followPages(session);
    expect(site().menu.follows).toBe("pages");
    // Every page again, in page order; a page item keeps its name.
    expect(rows()).toEqual(["My site", "Our story"]);
    followPages(session);

    session.history.undo();
    expect(site().menu).toEqual(custom);
    removeMenuItem(session, "missing" as MenuItemId);
    expect(site().menu).toEqual(custom);
  });
});
