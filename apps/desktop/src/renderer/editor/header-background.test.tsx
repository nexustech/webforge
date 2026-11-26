// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { EditPanelHost } from "./EditPanelHost.js";
import { headerBackgroundLine } from "./header-background-line.js";

// The Header on its page's first section (HH-1), in the Edit panel: its Background, the scroll
// styles it offers then, and the line a Hero that opens its page shows.

afterEach(cleanup);

/** The starter site with a Hero first on its home page, and the Edit panel for `nodeId`. */
function setup(nodeId: string) {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.unshift({
    type: "Hero",
    props: { id: "hero", ...structuredClone(siteLibrary.components.Hero?.defaults ?? {}) },
  });
  const session = sessionWith(site);
  session.select(nodeId);
  render(<EditPanelHost session={session} flush={vi.fn()} />);
  const header = () => session.history.document.getState().layout.header[0]?.props;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, header, labels, user: userEvent.setup({ delay: null }) };
}

/** The values the scroll style's list offers. */
const scrollStyles = () =>
  [...screen.getByLabelText<HTMLSelectElement>("Change style when scrolling").options].map(
    (option) => option.value,
  );

describe("the Header's Background (HH-1)", () => {
  it("joins the Header to the first section as one step, with its help saying every page", async () => {
    const { header, labels, session, user } = setup("header");
    await user.click(screen.getByRole("tab", { name: "Style" }));
    const field = screen.getByLabelText<HTMLSelectElement>("Background");
    expect(field.value).toBe("own");
    expect(screen.getByText(/On every page/)).toBeDefined();

    await user.selectOptions(field, "section");

    expect(header()?.background).toBe("section");
    expect(labels().at(-1)).toBe("Changed shared Header background");
    act(() => {
      session.history.undo();
    });
    expect(header()?.background).toBeUndefined();
  });

  it("offers Shadow, Shrink and Hide when scrolling down while joined, showing a saved Solid background as Shadow", async () => {
    const { header, session, user } = setup("header");
    act(() => {
      session.history.run("Changed shared Header", (draft) => {
        const props = draft.layout.header[0]?.props;
        if (props === undefined) return;
        props.sticky = true;
        props.scrollStyle = "solid";
      });
    });
    await user.click(screen.getByRole("tab", { name: "Style" }));
    expect(scrollStyles()).toEqual(["shadow", "shrink", "solid", "hide", "none"]);

    await user.selectOptions(screen.getByLabelText("Background"), "section");

    expect(scrollStyles()).toEqual(["shadow", "shrink", "hide"]);
    expect(screen.getByLabelText<HTMLSelectElement>("Change style when scrolling").value).toBe(
      "shadow",
    );
    // Kept for its own background.
    expect(header()?.scrollStyle).toBe("solid");
  });
});

describe("a Hero that opens its page (HH-1)", () => {
  it("shows a line that leads to the Header's Background, and selects the Header", async () => {
    const { session, user } = setup("hero");
    await user.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.getByText("The Header has a band of its own above this section.")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Change in the Header" }));

    expect(session.ui.getState().nodeId).toBe("header");
  });

  it("says so while the Header is on it", () => {
    const { session } = setup("hero");
    act(() => {
      session.history.run("Changed shared Header", (draft) => {
        const props = draft.layout.header[0]?.props;
        if (props !== undefined) props.background = "section";
      });
    });
    const site = session.history.document.getState();
    expect(headerBackgroundLine(site, site.homePageId, "hero")?.joined).toBe(true);
  });

  it("shows no line further down the page, or on a page whose Header is hidden", () => {
    const { session } = setup("hero");
    const site = session.history.document.getState();
    const second = site.pages[site.homePageId]?.doc.content[1]?.props.id;
    expect(headerBackgroundLine(site, site.homePageId, second)).toBeUndefined();
    act(() => {
      session.history.run("Changed Page Settings", (draft) => {
        const page = draft.pages[draft.homePageId];
        if (page !== undefined) page.settings.hideHeader = true;
      });
    });
    const hidden = session.history.document.getState();
    expect(headerBackgroundLine(hidden, hidden.homePageId, "hero")).toBeUndefined();
  });
});
