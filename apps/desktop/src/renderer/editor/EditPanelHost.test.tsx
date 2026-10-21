// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PageDoc, PageId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditPanelHost } from "./EditPanelHost.js";
import { createEditorSession, currentPage } from "./editor-session.js";
import { starterSite } from "./starter-site.js";

afterEach(cleanup);

/** The starter page plus a Hero, which has several text fields. */
function siteWithHero() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push({
    type: "Hero",
    props: { id: "hero", ...structuredClone(siteLibrary.components.Hero?.defaults ?? {}) },
  });
  return site;
}

function setup(nodeId: string | null = "heading-1") {
  const session = createEditorSession(siteLibrary, siteWithHero());
  session.ui.setState({ nodeId });
  const flush = vi.fn();
  render(<EditPanelHost session={session} flush={flush} />);
  const labels = () => session.history.entries().map((entry) => entry.label);
  const heading = () => {
    const section = currentPage(session)?.doc.content[0];
    return (section?.props.content as PageDoc["content"] | undefined)?.[0]?.props;
  };
  return { session, flush, labels, heading, user: userEvent.setup() };
}

describe("EditPanelHost", () => {
  it("asks for a selection when nothing is selected", () => {
    setup(null);

    expect(screen.getByText("Select an element to edit it")).toBeDefined();
  });

  it("shows the selected element's fields", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Heading" })).toBeDefined();
    expect((screen.getByLabelText("Text") as HTMLInputElement).value).toBe(
      "Welcome to our business",
    );
  });

  it("records a choice as one labelled step that keeps the element selected", async () => {
    const { session, flush, labels, heading, user } = setup();
    await user.click(screen.getByRole("tab", { name: "Style" }));

    await user.selectOptions(screen.getByLabelText("Size"), "small");

    expect(labels()).toEqual(["Changed Heading size"]);
    expect(heading()?.size).toBe("small");
    expect(flush).toHaveBeenCalled();
    expect(session.history.entries()[0]?.selectionAfter.nodeId).toBe("heading-1");
  });

  it("makes one step of a visit to a text field, however much is typed", async () => {
    const { session, labels, heading, user } = setup();
    const input = screen.getByLabelText("Text");

    await user.type(input, " today");
    fireEvent.blur(input);

    expect(labels()).toEqual(["Edited Heading text"]);
    expect(heading()?.text).toBe("Welcome to our business today");
    act(() => {
      session.history.undo();
    });
    expect(heading()?.text).toBe("Welcome to our business");
    expect((input as HTMLInputElement).value).toBe("Welcome to our business");
  });

  it("names the field for elements with several texts", async () => {
    const { labels, user } = setup("hero");

    await user.type(screen.getByLabelText("Button text"), "!");

    expect(labels()).toEqual(["Edited Hero button text"]);
  });

  it("shows the empty state for a selection on another page", () => {
    const { session } = setup();

    act(() => session.ui.setState({ pageId: "page-gone" as PageId }));

    expect(screen.getByText("Select an element to edit it")).toBeDefined();
  });
});
