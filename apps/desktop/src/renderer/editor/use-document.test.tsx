// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import type { PageId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it } from "vitest";
import { addPage, renamePage } from "../site/page-actions.js";
import { createEditorSession } from "./editor-session.js";
import { starterSite } from "./starter-site.js";
import { pageListOf, samePages, useDocument } from "./use-document.js";

afterEach(cleanup);

describe("pageListOf and samePages (R9)", () => {
  it("lists the same pages while only page content changes, and others when a page does", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const site = () => session.history.document.getState();
    const first = pageListOf(site());

    session.edit("text", "Edited Heading text", (draft) => {
      const home = draft.pages[draft.homePageId];
      if (home !== undefined) home.doc.content = [];
    });
    expect(pageListOf(site())).toBe(pageListOf(site()));
    expect(samePages(pageListOf(site()), first)).toBe(true);

    const about = addPage(session, "About");
    const added = pageListOf(site());
    expect(samePages(added, first)).toBe(false);
    expect(added.map((page) => page.title)).toContain("About");
    if (about === null) throw new Error("not added");
    renamePage(session, about, "Our story");
    expect(pageListOf(site()).map((page) => page.title)).toContain("Our story");
  });
});

describe("useDocument (R9)", () => {
  it("redraws a component only when its slice changes", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    let renders = 0;
    function Name() {
      renders += 1;
      return <p>{useDocument(session, (site) => site.settings.general.name)}</p>;
    }
    const { container } = render(<Name />);
    expect(renders).toBe(1);

    // Typing on the canvas: a new document, the same name.
    act(() =>
      session.edit("text", "Edited Heading text", (draft) => {
        const home = draft.pages[draft.homePageId];
        if (home !== undefined) home.doc.content = [];
      }),
    );
    expect(renders).toBe(1);

    act(() =>
      session.edit("props", "Changed Site Settings", (draft) => {
        draft.settings.general.name = "Bloom Bakery";
      }),
    );
    expect(renders).toBe(2);
    expect(container.textContent).toBe("Bloom Bakery");
  });
});

describe("the UI store (R9)", () => {
  it("changes only through the session, never to a page the site doesn't have", () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const ui = () => session.ui.getState();
    const home = ui().pageId;

    session.select("heading-1");
    session.setViewport("mobile");
    expect(ui()).toEqual({ pageId: home, nodeId: "heading-1", viewport: "mobile" });

    // Another page shows with nothing selected, in the same device view; a missing one doesn't.
    const about = addPage(session, "About");
    if (about === null) throw new Error("not added");
    session.showPage(home);
    session.select("heading-1");
    session.showPage("page-gone" as PageId);
    expect(ui()).toEqual({ pageId: home, nodeId: "heading-1", viewport: "mobile" });
    session.showPage(about);
    expect(ui()).toEqual({ pageId: about, nodeId: null, viewport: "mobile" });

    // An edit shows the selection it ends with when asked to, and only on a page there is.
    session.edit("props", "Edited menu", () => undefined, {
      selectionAfter: { pageId: home, nodeId: "section-1", viewport: "desktop" },
      apply: true,
    });
    expect(ui()).toEqual({ pageId: home, nodeId: "section-1", viewport: "desktop" });
    session.edit("props", "Edited menu", () => undefined, {
      selectionAfter: { pageId: "page-gone" as PageId, nodeId: null, viewport: "desktop" },
      apply: true,
    });
    expect(ui().pageId).toBe(home);
    // Without `apply`, the selection is only what undo shows again.
    session.edit("props", "Edited menu", () => undefined, {
      selectionAfter: { pageId: home, nodeId: "heading-1", viewport: "desktop" },
    });
    expect(ui().nodeId).toBe("section-1");
  });
});
