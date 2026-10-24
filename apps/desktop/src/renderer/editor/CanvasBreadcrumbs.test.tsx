// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  copiedNodeId,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { createFakeEngine } from "@webforge/test-utils/renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { selectionPath } from "./breadcrumbs.js";
import { CanvasBreadcrumbs } from "./CanvasBreadcrumbs.js";
import { starterSite } from "./starter-site.js";

const HOURS = "shared-hours" as SharedSectionId;

const heading = (id: string, extra: Record<string, unknown> = {}): NodeDoc => ({
  type: "Heading",
  props: { id, text: id, ...extra },
});

/**
 * A home page "Home" with a Section holding a named Heading, then a linked copy of "Opening hours";
 * a Header region with a Section holding a Heading.
 */
function site(): SiteDoc {
  const base = starterSite();
  const home = base.pages[base.homePageId];
  if (home === undefined) throw new Error("no home page");
  return {
    ...base,
    pages: {
      ...base.pages,
      [home.id]: {
        ...home,
        title: "Home",
        doc: {
          root: { props: {} },
          content: [
            {
              type: "Section",
              props: { id: "s1", content: [heading("a", { layerName: "Intro" })] },
            },
            { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } },
          ],
        },
      },
    },
    layout: {
      ...base.layout,
      header: [{ type: "Section", props: { id: "top", content: [heading("logo")] } }],
    },
    sharedSections: {
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: { type: "Section", props: { id: "s", content: [heading("t")] } },
      },
    },
  };
}

describe("selectionPath (1.30, UX-9)", () => {
  const path = (nodeId: string | null) => {
    const doc = site();
    return selectionPath(doc, doc.homePageId, nodeId, siteLibrary).map(({ id, label }) => [
      id,
      label,
    ]);
  };

  it("goes from the page down to the selected element, by Layers' names", () => {
    expect(path(null)).toEqual([[null, "Home"]]);
    expect(path("a")).toEqual([
      [null, "Home"],
      ["s1", "Section"],
      ["a", "Intro"],
    ]);
    // An element the page doesn't have: just the page.
    expect(path("gone")).toEqual([[null, "Home"]]);
    // A page with no title yet.
    const untitled = site();
    const home = untitled.pages[untitled.homePageId];
    if (home !== undefined) home.title = " ";
    expect(selectionPath(untitled, untitled.homePageId, null, siteLibrary)[0]?.label).toBe("Page");
  });

  it("names the shared Header, and a linked copy by its section, under the canvas's ids", () => {
    expect(path("logo")).toEqual([
      [null, "Home"],
      ["top", "Header"],
      ["logo", "Heading"],
    ]);
    expect(path(copiedNodeId("c1", "t"))).toEqual([
      [null, "Home"],
      [copiedNodeId("c1", "s"), "Opening hours"],
      [copiedNodeId("c1", "t"), "Heading"],
    ]);
  });
});

describe("CanvasBreadcrumbs", () => {
  afterEach(cleanup);

  it("follows the selection, selects on click and outlines on hover", async () => {
    const session = sessionWith(site());
    const engine = createFakeEngine();
    render(<CanvasBreadcrumbs session={session} engine={engine} />);
    const crumbs = () => screen.getAllByRole("button").map((button) => button.textContent);

    expect(screen.getByRole("navigation", { name: "Where the selection is" })).toBeDefined();
    expect(crumbs()).toEqual(["Home"]);
    act(() => session.select("a"));
    expect(crumbs()).toEqual(["Home", "Section", "Intro"]);
    expect(screen.getByRole("button", { name: "Intro" }).getAttribute("aria-current")).toBe(
      "location",
    );

    await userEvent.hover(screen.getByRole("button", { name: "Section" }));
    expect(engine.outline).toHaveBeenLastCalledWith("s1");
    await userEvent.click(screen.getByRole("button", { name: "Section" }));
    expect(session.ui.getState().nodeId).toBe("s1");
    await userEvent.unhover(screen.getByRole("button", { name: "Section" }));
    expect(engine.outline).toHaveBeenLastCalledWith(null);

    // The page: nothing selected.
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(session.ui.getState().nodeId).toBeNull();
  });

  it("takes the outline away when the step under the pointer goes, or the bar (#253 review)", async () => {
    const session = sessionWith(site());
    const engine = createFakeEngine();
    session.select("a");
    const { unmount } = render(<CanvasBreadcrumbs session={session} engine={engine} />);

    await userEvent.hover(screen.getByRole("button", { name: "Intro" }));
    expect(engine.outline).toHaveBeenLastCalledWith("a");
    // Esc or Delete while the pointer is on it: the step goes, and the pointer never leaves it.
    act(() => session.select(null));
    expect(engine.outline).toHaveBeenLastCalledWith(null);

    act(() => session.select("a"));
    await userEvent.hover(screen.getByRole("button", { name: "Section" }));
    vi.mocked(engine.outline).mockClear();
    unmount();
    expect(engine.outline).toHaveBeenCalledWith(null);
  });
});
