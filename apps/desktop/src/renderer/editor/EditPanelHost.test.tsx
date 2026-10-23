// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copiedNodeId, type MediaId, type PageDoc, type PageId } from "@webforge/model";
import { type ComponentLibrary, siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerImageField } from "../media/ImageField.js";
import { addMedia } from "../media/media-commands.js";
import { saveAsSharedSection } from "../shared-sections/shared-sections.js";
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
  // No wait between keystrokes: each redraws the panel, which in a busy full run took the Advanced
  // tab's tests past their timeout (see LinkField.test.tsx).
  return {
    session,
    flush,
    labels,
    heading,
    section,
    questions,
    user: userEvent.setup({ delay: null }),
  };
}

describe("EditPanelHost in Content mode (M3)", () => {
  it("keeps texts, links and list items, and leaves styles out", async () => {
    const session = createEditorSession(siteLibrary, siteWithHero());
    session.ui.setState({ nodeId: "hero" });
    const view = render(<EditPanelHost session={session} flush={vi.fn()} contentOnly />);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Content"]);
    expect(screen.getByRole("textbox", { name: "Title" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Button text" })).toBeTruthy();
    expect(screen.queryByText("Alignment")).toBeNull();
    // A list's items stay editable.
    act(() => session.ui.setState({ nodeId: "faq" }));
    view.rerender(<EditPanelHost session={session} flush={vi.fn()} contentOnly />);
    expect(screen.getByRole("button", { name: /Add Question/ })).toBeTruthy();
  });
});

describe("EditPanelHost", () => {
  it("asks for a selection when nothing is selected", () => {
    setup(null);

    expect(screen.getByText("Select an element to edit it")).toBeDefined();
  });

  it("says how many elements are selected while several are (1.31)", () => {
    const { session } = setup();
    act(() => session.ui.setState({ nodeId: "heading-1", others: ["text-1", "hero-1"] }));

    expect(screen.getByRole("status").textContent).toBe("3 elements selected");
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

  it("edits an element of a linked copy in its shared section, which every copy shows (F-ED-23)", async () => {
    const { session, labels, user } = setup("section-1");
    act(() => {
      saveAsSharedSection(session, "Welcome");
    });
    const [shared] = Object.values(session.history.document.getState().sharedSections);
    if (shared === undefined) throw new Error("not saved");
    const copyId = currentPage(session)?.doc.content[0]?.props.id ?? "";
    act(() => session.ui.setState({ nodeId: copiedNodeId(copyId, "heading-1") }));
    const sharedHeading = () =>
      (
        session.history.document.getState().sharedSections[shared.id]?.section.props.content as
          | PageDoc["content"]
          | undefined
      )?.[0]?.props;
    const pageBefore = currentPage(session)?.doc;
    const input = screen.getByLabelText("Text");

    await user.type(input, " today");
    fireEvent.blur(input);

    expect(sharedHeading()?.text).toBe("Welcome to our business today");
    expect(currentPage(session)?.doc).toBe(pageBefore);
    expect(labels()).toEqual([
      "Saved 'Welcome' as a shared section",
      "Edited shared section 'Welcome'",
    ]);
    // Still selected as the canvas shows it.
    expect(session.history.entries()[1]?.selectionAfter.nodeId).toBe(
      copiedNodeId(copyId, "heading-1"),
    );
    act(() => {
      session.history.undo();
    });
    expect(sharedHeading()?.text).toBe("Welcome to our business");
  });

  it("edits the shared Footer in the site's layout, which every page shows (F-ED-7)", async () => {
    const { session, labels, user } = setup("footer");
    const footer = () => session.history.document.getState().layout.footer[0]?.props;
    const pageBefore = currentPage(session)?.doc;
    const input = screen.getByLabelText("Text");
    expect(screen.getByRole("heading", { name: "Footer" })).toBeDefined();

    await user.type(input, " Bye!");
    fireEvent.blur(input);

    expect(footer()?.text).toBe("Thanks for visiting. Bye!");
    expect(labels()).toEqual(["Edited shared Footer text"]);
    expect(currentPage(session)?.doc).toBe(pageBefore);
    act(() => {
      session.history.undo();
    });
    expect(footer()?.text).toBe("Thanks for visiting.");
  });

  describe("style fields (1.14 part 2)", () => {
    /** The choices for one side of a box field: "Padding Top". */
    const side = (name: string) => within(screen.getByRole("radiogroup", { name }));

    it("sets a value for the device being viewed, marks it and drops it again", async () => {
      const { session, labels, section, user } = setup("section-1");
      act(() => session.ui.setState({ viewport: "mobile" }));

      await user.click(side("Padding Top").getByRole("radio", { name: "S" }));

      expect(section()?.padding).toEqual({
        $responsive: { desktop: { top: "m", bottom: "m" }, mobile: { top: "s", bottom: "m" } },
      });
      expect(screen.getByText("Mobile only")).toBeDefined();
      act(() => session.ui.setState({ viewport: "desktop" }));
      expect(screen.queryByText("Mobile only")).toBeNull();
      expect(
        side("Padding Top").getByRole("radio", { name: "M" }).getAttribute("aria-checked"),
      ).toBe("true");

      act(() => session.ui.setState({ viewport: "mobile" }));
      await user.click(screen.getByRole("button", { name: "Use Desktop value" }));

      expect(section()?.padding).toEqual({ top: "m", bottom: "m" });
      expect(labels()).toEqual([
        "Changed Section padding on Mobile",
        "Reset Section padding on Mobile",
      ]);
    });

    it("sets Desktop's value as the plain value, keeping other devices' own", async () => {
      const { session, labels, section, user } = setup("section-1");
      act(() => session.ui.setState({ viewport: "tablet" }));
      await user.click(side("Padding Bottom").getByRole("radio", { name: "L" }));
      act(() => session.ui.setState({ viewport: "desktop" }));

      await user.click(side("Padding Left").getByRole("radio", { name: "None" }));

      expect(section()?.padding).toEqual({
        $responsive: {
          desktop: { top: "m", bottom: "m", left: "none" },
          tablet: { top: "m", bottom: "l" },
        },
      });
      expect(labels()).toEqual(["Changed Section padding on Tablet", "Changed Section padding"]);
    });

    it("writes a padding saved before 1.32 in the new form, every side at once (1.32)", async () => {
      const { session, labels, section, user } = setup("section-1");
      act(() =>
        session.edit("props", "Old padding", (draft) => {
          const old = draft.pages[draft.homePageId]?.doc.content[0];
          if (old !== undefined) {
            old.props.padding = { $responsive: { desktop: "large", mobile: "small" } };
          }
        }),
      );
      // Top and bottom are Large, left and right the section's own: not the same on every side.
      expect(
        side("Padding Top").getByRole("radio", { name: "L" }).getAttribute("aria-checked"),
      ).toBe("true");

      await user.click(screen.getByRole("switch", { name: "Padding Same on every side" }));
      await user.click(side("Padding").getByRole("radio", { name: "XL" }));

      expect(section()?.padding).toEqual({
        $responsive: {
          desktop: { top: "xl", right: "xl", bottom: "xl", left: "xl" },
          mobile: { top: "s", bottom: "s" },
        },
      });
      expect(labels().at(-1)).toBe("Changed Section padding");

      await user.click(side("Padding").getByRole("radio", { name: "Default" }));
      expect(section()?.padding).toEqual({
        $responsive: { desktop: {}, mobile: { top: "s", bottom: "s" } },
      });
    });

    it("shows each Section's and device's sides as they are, not the last one's (1.32)", async () => {
      const { session, user } = setup("section-1");
      act(() =>
        session.edit("props", "Two sections", (draft) => {
          const content = draft.pages[draft.homePageId]?.doc.content;
          const first = content?.[0];
          if (content === undefined || first === undefined) return;
          first.props.padding = { $responsive: { desktop: { top: "m" }, mobile: {} } };
          content.push({ type: "Section", props: { id: "section-2", padding: {} } });
        }),
      );
      expect(
        side("Padding Top").getByRole("radio", { name: "M" }).getAttribute("aria-checked"),
      ).toBe("true");

      // Every side the same on Mobile: one row for all of them.
      act(() => session.ui.setState({ viewport: "mobile" }));
      expect(screen.queryByRole("radiogroup", { name: "Padding Top" })).toBeNull();
      act(() => session.ui.setState({ viewport: "desktop" }));
      expect(side("Padding Top")).toBeDefined();

      act(() => session.ui.setState({ nodeId: "section-2" }));
      expect(screen.queryByRole("radiogroup", { name: "Padding Top" })).toBeNull();
      await user.click(screen.getByRole("switch", { name: "Padding Same on every side" }));
      act(() => session.ui.setState({ nodeId: "section-1" }));
      expect(side("Padding Top")).toBeDefined();
      act(() => session.ui.setState({ nodeId: "section-2" }));
      expect(
        side("Padding").getByRole("radio", { name: "Default" }).getAttribute("aria-checked"),
      ).toBe("true");
    });

    it("sets an element's margin above and below only (1.32)", async () => {
      const { labels, heading, user } = setup("heading-1");
      await user.click(screen.getByRole("tab", { name: "Style" }));

      expect(screen.queryByRole("radiogroup", { name: "Margin Left" })).toBeNull();
      await user.click(screen.getByRole("switch", { name: "Margin Same on every side" }));
      await user.click(side("Margin Bottom").getByRole("radio", { name: "L" }));

      expect(heading()?.margin).toEqual({ bottom: "l" });
      expect(labels()).toEqual(["Changed Heading margin"]);
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
      await userEvent
        .setup({ delay: null })
        .click(screen.getByRole("button", { name: "Rating 1" }));
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

  describe("Advanced tab (F-ED-11)", () => {
    function setupAdvanced() {
      const session = createEditorSession(siteLibrary, siteWithHero());
      session.ui.setState({ nodeId: "heading-1" });
      render(<EditPanelHost session={session} flush={vi.fn()} advanced />);
      const labels = () => session.history.entries().map((entry) => entry.label);
      const advanced = () => {
        const section = currentPage(session)?.doc.content[0];
        return (section?.props.content as PageDoc["content"] | undefined)?.[0]?.props.advanced;
      };
      return { session, labels, advanced, user: userEvent.setup({ delay: null }) };
    }

    it("is only there in Advanced mode", () => {
      setup();
      expect(screen.queryByRole("tab", { name: "Advanced" })).toBeNull();
    });

    it("sets classes and the anchor, one labelled step each, refusing an invalid anchor", async () => {
      const { session, labels, advanced, user } = setupAdvanced();
      await user.click(screen.getByRole("tab", { name: "Advanced" }));

      await user.type(screen.getByLabelText("CSS classes"), "shadow-lg  italic{Enter}");
      await user.type(screen.getByLabelText("Anchor ID"), "Welcome!{Enter}");
      expect(screen.getByText(/lowercase letters/)).toBeDefined();
      await user.clear(screen.getByLabelText("Anchor ID"));
      await user.type(screen.getByLabelText("Anchor ID"), "welcome{Enter}");

      expect(advanced()).toEqual({ className: "shadow-lg italic", anchorId: "welcome" });
      expect(labels()).toEqual(["Changed Heading CSS classes", "Changed Heading anchor ID"]);
      act(() => {
        session.history.undo();
        session.history.undo();
      });
      expect(advanced()).toBeUndefined();
    });

    it("sets the shared Footer's classes in the site's layout", async () => {
      const { session, labels, user } = setupAdvanced();
      act(() => session.ui.setState({ nodeId: "footer" }));
      await user.click(screen.getByRole("tab", { name: "Advanced" }));

      await user.type(screen.getByLabelText("CSS classes"), "italic{Enter}");

      const footer = session.history.document.getState().layout.footer[0];
      expect(footer?.props.advanced).toEqual({ className: "italic" });
      expect(labels()).toEqual(["Changed shared Footer CSS classes"]);
    });

    it("refuses an anchor that another element on the page, or the Header, already uses", async () => {
      const { session, advanced, user } = setupAdvanced();
      act(() =>
        session.edit("props", "Changed Header anchor ID", (draft) => {
          const header = draft.layout.header[0];
          if (header !== undefined) header.props.advanced = { anchorId: "top" };
        }),
      );
      await user.click(screen.getByRole("tab", { name: "Advanced" }));

      await user.type(screen.getByLabelText("Anchor ID"), "top{Enter}");

      expect(
        screen.getByText("Another element on this page already uses this anchor"),
      ).toBeDefined();
      expect(advanced()).toBeUndefined();
    });

    it("refuses a Footer anchor that an element of another page showing it uses", async () => {
      const { session, user } = setupAdvanced();
      act(() => {
        session.edit("props", "Changed Heading anchor ID", (draft) => {
          const notFound = Object.values(draft.pages).find((page) => page.kind === "not-found");
          const first = notFound?.doc.content[0];
          if (first !== undefined) first.props.advanced = { anchorId: "contact" };
        });
        session.ui.setState({ nodeId: "footer" });
      });
      await user.click(screen.getByRole("tab", { name: "Advanced" }));

      await user.type(screen.getByLabelText("Anchor ID"), "contact{Enter}");

      expect(
        screen.getByText("Another element on this page already uses this anchor"),
      ).toBeDefined();
      expect(session.history.document.getState().layout.footer[0]?.props.advanced).toBeUndefined();
    });

    it("adds and renames an attribute", async () => {
      const { labels, advanced, user } = setupAdvanced();
      await user.click(screen.getByRole("tab", { name: "Advanced" }));

      await user.click(screen.getByRole("button", { name: "Add Attribute" }));
      const name = screen.getByLabelText("Name");
      await user.clear(name);
      await user.type(name, "role{Enter}");
      await user.type(screen.getByLabelText("Value"), "note{Enter}");

      expect(advanced()).toEqual({ attributes: { role: "note" } });
      expect(labels()).toEqual([
        "Changed Heading attributes",
        "Changed Heading attributes",
        "Changed Heading attributes",
      ]);
    });
  });

  it("shows a Site Settings value in a Heading, and its own text again, one step each (1.17)", async () => {
    const { labels, heading, user } = setup();

    await user.selectOptions(screen.getByLabelText("Text shows"), "contact.phone");
    expect(heading()?.bindings).toEqual({ text: "contact.phone" });
    // Its own text waits, kept, while it shows the Site Settings value.
    expect(screen.queryByLabelText("Text")).toBeNull();
    expect(heading()?.text).toBe("Welcome to our business");

    await user.selectOptions(screen.getByLabelText("Text shows"), "");
    expect(heading()?.bindings).toBeUndefined();
    expect((screen.getByLabelText("Text") as HTMLInputElement).value).toBe(
      "Welcome to our business",
    );
    expect(labels()).toEqual(["Heading shows Phone number", "Heading shows its own text"]);
  });

  describe("image field", () => {
    const shop = {
      id: "shop" as MediaId,
      hash: "a".repeat(64),
      name: "shop",
      fileName: "shop.jpg",
      kind: "image",
      mimeType: "image/jpeg",
      width: 800,
      height: 600,
      alt: "Our shop",
    } as const;

    it("places a Media image in one step, then types its alt text here as another", async () => {
      const { session, labels, user } = setup("hero");
      const unregister = registerImageField({
        session,
        media: { choose: async () => ({ status: "canceled" }) },
        imageUrl: (item) => `test://${item.name}`,
      });
      act(() => addMedia(session, [shop]));
      const hero = () => currentPage(session)?.doc.content[1]?.props;

      try {
        // The image is content, like the Hero's texts.
        await user.click(screen.getByRole("tab", { name: "Content" }));
        await user.click(screen.getByRole("button", { name: "Image Choose an image…" }));
        await user.dblClick(screen.getByRole("option", { name: "shop.jpg" }));
        const alt = screen.getByLabelText("Alt text here");
        await user.type(alt, "Fresh");
        fireEvent.blur(alt);

        expect(hero()?.image).toEqual({ mediaId: "shop", alt: "Fresh" });
        expect(labels()).toEqual([
          "Added image 'shop.jpg'",
          "Changed Hero image",
          "Changed Hero image",
        ]);
        act(() => {
          session.history.undo();
        });
        expect(hero()?.image).toEqual({ mediaId: "shop" });
      } finally {
        unregister();
      }
    });
  });
});
