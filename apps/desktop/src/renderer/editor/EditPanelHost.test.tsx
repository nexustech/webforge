// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PageDoc, PageId } from "@webforge/model";
import { type ComponentLibrary, siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditPanelHost } from "./EditPanelHost.js";
import { createEditorSession, currentPage, runHistoryCommand } from "./editor-session.js";
import { starterSite } from "./starter-site.js";

afterEach(cleanup);

/** The starter page plus a Hero, which has several text fields. */
function siteWithHero() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push(
    {
      type: "Hero",
      props: { id: "hero", ...structuredClone(siteLibrary.components.Hero?.defaults ?? {}) },
    },
    {
      type: "Faq",
      props: {
        id: "faq",
        title: "Questions",
        items: [
          {
            type: "FaqItem",
            props: { id: "q1", question: "Open on Sunday?", answer: "<p>No</p>" },
          },
          { type: "FaqItem", props: { id: "q2", question: "Parking?", answer: "<p>Yes</p>" } },
        ],
      },
    },
  );
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
  const section = () => currentPage(session)?.doc.content[0]?.props;
  const questions = () =>
    (currentPage(session)?.doc.content[2]?.props.items as PageDoc["content"] | undefined)?.map(
      (item) => item.props.question,
    );
  return { session, flush, labels, heading, section, questions, user: userEvent.setup() };
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

  it("ends a field's run of edits when the selection moves on while it has focus", async () => {
    const { session, labels, user } = setup();
    const input = screen.getByLabelText("Text");
    await user.type(input, "!");

    act(() => session.ui.setState({ nodeId: "hero" }));
    act(() => session.ui.setState({ nodeId: "heading-1" }));
    await user.type(screen.getByLabelText("Text"), "?");

    expect(labels()).toEqual(["Edited Heading text", "Edited Heading text"]);
  });

  it("names the field for elements with several texts", async () => {
    const { labels, user } = setup("hero");

    await user.type(screen.getByLabelText("Button text"), "!");

    expect(labels()).toEqual(["Edited Hero button text"]);
  });

  it("writes nothing back when its element is deleted while a field is open", async () => {
    const { session, labels, user } = setup();
    const input = screen.getByLabelText("Text");
    await user.type(input, "!");

    act(() => {
      session.edit("remove", "Deleted Heading", (draft) => {
        const home = draft.pages[draft.homePageId]?.doc.content[0];
        if (home !== undefined) home.props.content = [];
      });
      session.ui.setState({ nodeId: null });
    });
    fireEvent.blur(input);

    expect(screen.getByText("Select an element to edit it")).toBeDefined();
    expect(labels()).toEqual(["Edited Heading text", "Deleted Heading"]);
    const section = currentPage(session)?.doc.content[0];
    expect(section?.props.content).toEqual([]);
  });

  it("shows the empty state for a selection on another page", () => {
    const { session } = setup();

    act(() => session.ui.setState({ pageId: "page-gone" as PageId }));

    expect(screen.getByText("Select an element to edit it")).toBeDefined();
  });

  describe("style fields (1.14 part 2)", () => {
    it("sets a value for the device being viewed, marks it and drops it again", async () => {
      const { session, labels, section, user } = setup("section-1");
      act(() => session.ui.setState({ viewport: "mobile" }));

      await user.click(screen.getByRole("radio", { name: "Small" }));

      expect(section()?.padding).toEqual({ $responsive: { desktop: "medium", mobile: "small" } });
      expect(screen.getByText("Mobile only")).toBeDefined();
      act(() => session.ui.setState({ viewport: "desktop" }));
      expect(screen.queryByText("Mobile only")).toBeNull();
      expect(screen.getByRole("radio", { name: "Medium" }).getAttribute("aria-checked")).toBe(
        "true",
      );

      act(() => session.ui.setState({ viewport: "mobile" }));
      await user.click(screen.getByRole("button", { name: "Use Desktop value" }));

      expect(section()?.padding).toBe("medium");
      expect(labels()).toEqual([
        "Changed Section padding on Mobile",
        "Reset Section padding on Mobile",
      ]);
    });

    it("sets Desktop's value as the plain value, keeping other devices' own", async () => {
      const { session, labels, section, user } = setup("section-1");
      act(() => session.ui.setState({ viewport: "tablet" }));
      await user.click(screen.getByRole("radio", { name: "Large" }));
      act(() => session.ui.setState({ viewport: "desktop" }));

      await user.click(screen.getByRole("radio", { name: "Small" }));

      expect(section()?.padding).toEqual({ $responsive: { desktop: "small", tablet: "large" } });
      expect(labels()).toEqual(["Changed Section padding on Tablet", "Changed Section padding"]);
    });

    it("makes one step of a slider drag, from the default of a value never set", () => {
      const { session, labels, section } = setup("section-1");
      const slider = screen.getByLabelText("Space between elements") as HTMLInputElement;
      expect(slider.value).toBe("2");

      fireEvent.pointerDown(slider);
      fireEvent.change(slider, { target: { value: "3" } });
      fireEvent.change(slider, { target: { value: "1" } });
      expect(section()?.gap).toBe("small");
      fireEvent.pointerUp(slider);

      expect(labels()).toEqual(["Changed Section space between elements"]);
      act(() => {
        session.history.undo();
      });
      expect(section()?.gap).toBeUndefined();
    });

    it("puts a slider back as it was when the drag is cancelled with Esc", () => {
      const { session, labels, section } = setup("section-1");
      const slider = screen.getByLabelText("Space between elements");

      fireEvent.pointerDown(slider);
      fireEvent.change(slider, { target: { value: "0" } });
      act(() => {
        runHistoryCommand(session, "cancel");
      });
      fireEvent.pointerUp(slider);

      expect(section()?.gap).toBeUndefined();
      expect(labels()).toEqual([]);

      fireEvent.pointerDown(slider);
      fireEvent.change(slider, { target: { value: "3" } });
      fireEvent.pointerUp(slider);
      expect(labels()).toEqual(["Changed Section space between elements"]);
    });

    it("ends a drag when the device view changes, so each step names its device", () => {
      const { session, labels, section } = setup("section-1");
      act(() => session.ui.setState({ viewport: "mobile" }));
      const slider = () => screen.getByLabelText("Space between elements");

      fireEvent.pointerDown(slider());
      fireEvent.change(slider(), { target: { value: "0" } });
      act(() => session.ui.setState({ viewport: "desktop" }));
      fireEvent.change(slider(), { target: { value: "3" } });
      fireEvent.pointerUp(slider());

      expect(section()?.gap).toEqual({ $responsive: { desktop: "large", mobile: "none" } });
      expect(labels()).toEqual([
        "Changed Section space between elements on Mobile",
        "Changed Section space between elements",
      ]);
    });

    it("cancels a drag when the panel closes during it", () => {
      const { session, labels, section } = setup("section-1");
      const slider = screen.getByLabelText("Space between elements");
      fireEvent.pointerDown(slider);
      fireEvent.change(slider, { target: { value: "0" } });

      cleanup();

      expect(section()?.gap).toBeUndefined();
      expect(labels()).toEqual([]);
      expect(session.history.entries()).toEqual([]);
    });

    it("switches a toggle as one step", async () => {
      const { labels, section, user } = setup("section-1");

      await user.click(screen.getByRole("switch", { name: "Full width" }));

      expect(section()?.fullWidth).toBe(true);
      expect(labels()).toEqual(["Changed Section full width"]);
    });
  });

  describe("repeating lists (F-ED-6)", () => {
    it("shows a FAQ's questions as a list, one row each", () => {
      setup("faq");

      const list = screen.getByRole("group", { name: "Questions" });
      expect(list.querySelectorAll("li")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Open on Sunday?" })).toBeDefined();
    });

    it("adds, moves and deletes questions, one labelled step each, keeping the FAQ selected", async () => {
      const { session, labels, questions, user } = setup("faq");

      await user.click(screen.getByRole("button", { name: "Add Question" }));
      expect(questions()).toHaveLength(3);
      // The new question is open, ready to be written.
      expect((screen.getByLabelText("Question") as HTMLInputElement).value).toBe(questions()?.[2]);
      await user.click(screen.getAllByRole("button", { name: "Move Question down" })[0] as Element);
      await user.click(screen.getAllByRole("button", { name: "Delete Question" })[2] as Element);

      expect(questions()).toEqual(["Parking?", "Open on Sunday?"]);
      expect(labels()).toEqual(["Added Question", "Moved Question", "Deleted Question"]);
      expect(session.ui.getState().nodeId).toBe("faq");
      act(() => {
        session.history.undo();
        session.history.undo();
      });
      expect(questions()?.slice(0, 2)).toEqual(["Open on Sunday?", "Parking?"]);
    });

    it("makes one step of a slider drag in a list item", async () => {
      const library: ComponentLibrary = {
        components: {
          ...siteLibrary.components,
          Ratings: {
            label: "Ratings",
            fields: {
              items: {
                kind: "list",
                label: "Ratings",
                itemLabel: "Rating",
                fields: {
                  stars: {
                    kind: "slider",
                    label: "Stars",
                    steps: ["1", "2", "3"].map((value) => ({ label: value, value })),
                  },
                },
                defaults: { stars: "1" },
              },
            },
            defaults: { items: [] },
            render: () => null,
          },
        },
      };
      const site = starterSite();
      site.pages[site.homePageId]?.doc.content.push({
        type: "Ratings",
        props: { id: "ratings", items: [{ id: "r1", stars: "1" }] },
      });
      const session = createEditorSession(library, site);
      session.ui.setState({ nodeId: "ratings" });
      render(<EditPanelHost session={session} flush={vi.fn()} />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Rating 1" }));
      const slider = screen.getByLabelText("Stars");

      fireEvent.pointerDown(slider);
      fireEvent.change(slider, { target: { value: "1" } });
      fireEvent.change(slider, { target: { value: "2" } });
      fireEvent.pointerUp(slider);
      fireEvent.pointerDown(slider);
      fireEvent.change(slider, { target: { value: "0" } });
      fireEvent.pointerUp(slider);

      expect(session.history.entries().map((entry) => entry.label)).toEqual([
        "Changed Rating stars",
        "Changed Rating stars",
      ]);
      expect(currentPage(session)?.doc.content[1]?.props.items).toEqual([{ id: "r1", stars: "1" }]);
    });

    it("makes one step of typing in a question, and another for the next question", async () => {
      const { labels, questions, user } = setup("faq");
      await user.click(screen.getByRole("button", { name: "Open on Sunday?" }));
      const first = screen.getByLabelText("Question");

      await user.type(first, "!!");
      await user.click(screen.getByRole("button", { name: "Parking?" }));
      await user.type(screen.getByLabelText("Question"), "?");

      expect(questions()).toEqual(["Open on Sunday?!!", "Parking??"]);
      expect(labels()).toEqual(["Edited Question text", "Edited Question text"]);
    });
  });
});
