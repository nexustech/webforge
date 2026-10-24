import type { NavItem } from "@webforge/site-components";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { addPage } from "../site/index.js";
import { connectCanvasNavigation } from "./canvas-navigation.js";
import { addMenuItem, renameMenuItem } from "./menu-actions.js";

function setUp() {
  const session = createEditorSession(siteLibrary, starterSite());
  const about = addPage(session, "About");
  if (about === null) throw new Error("not added");
  session.showPage(session.history.document.getState().homePageId);
  const engine = { setNavigation: vi.fn<(navigation: readonly NavItem[]) => void>() };
  const stop = connectCanvasNavigation(engine, session);
  const shown = () => engine.setNavigation.mock.calls.at(-1)?.[0];
  return { session, engine, about, stop, shown };
}

describe("connectCanvasNavigation (F-ED-17)", () => {
  it("shows the navigation the export makes, with links that go nowhere on the canvas", () => {
    const { session, shown } = setUp();

    addMenuItem(session, {
      kind: "button",
      label: "Book now",
      change: { link: { kind: "url", href: "https://book.example", newTab: true } },
    });

    expect(shown()).toEqual([
      expect.objectContaining({ label: "My site", href: "#", current: true }),
      expect.objectContaining({ label: "About", href: "#", current: false }),
      { id: expect.any(String), label: "Book now", href: "#", current: false, button: true },
    ]);
  });

  it("draws the canvas again for menu and page changes, but not while the content is edited", () => {
    const { session, engine, about, stop, shown } = setUp();
    const calls = () => engine.setNavigation.mock.calls.length;
    const before = calls();

    session.edit("text", "Edited Heading text", (draft) => {
      const page = draft.pages[draft.homePageId];
      if (page !== undefined) page.doc.root.props = { title: "x" };
    });
    expect(calls()).toBe(before);

    const id = session.history.document.getState().menu.items[1]?.id;
    if (id === undefined) throw new Error("no About item");
    renameMenuItem(session, id, "Our story");
    expect(shown()?.[1]).toMatchObject({ label: "Our story" });

    session.showPage(about);
    expect(shown()?.[1]).toMatchObject({ label: "Our story", current: true });
    // Undo is a change like any other: the canvas follows it.
    session.history.undo();
    expect(shown()?.[1]).toMatchObject({ label: "About" });

    stop();
    renameMenuItem(session, id, "Team");
    expect(shown()?.[1]).toMatchObject({ label: "About" });
  });
});
