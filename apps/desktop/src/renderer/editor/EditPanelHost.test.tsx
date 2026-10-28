// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FieldRenderers, FieldRenderersProvider } from "@webforge/editor-ui";
import { copiedNodeId, type MediaId, type PageDoc } from "@webforge/model";
import {
  BACKGROUND_FIELDS,
  type ComponentLibrary,
  type FieldDef,
  siteLibrary,
} from "@webforge/site-components";
import { themePreset } from "@webforge/themes";
import { Profiler } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasApi } from "../../shared/ipc/canvas.js";
import { starterSite } from "../../shared/starter-site.js";
import { classesFieldRenderer } from "../fields/index.js";
import { linkFieldRenderer } from "../links/index.js";
import { addMedia, imageFieldRenderer } from "../media/index.js";
import { sessionWith } from "../testing/fixtures.js";
import { EditPanelHost } from "./EditPanelHost.js";
import {
  createEditorSession,
  currentPage,
  type EditorSession,
  runHistoryCommand,
} from "./editor-session.js";
import { placedOverlay } from "./placed-overlay.js";
import { saveAsSharedSection } from "./shared-sections.js";

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

/** The Edit panel for `nodeId`, with the app's renderers `renderersOf` gives for its session. */
function setup(
  nodeId: string | null = "heading-1",
  renderersOf: (session: EditorSession) => FieldRenderers = () => ({}),
) {
  const session = sessionWith(siteWithHero());
  session.select(nodeId);
  const flush = vi.fn();
  render(
    <FieldRenderersProvider renderers={renderersOf(session)}>
      <EditPanelHost session={session} flush={flush} />
    </FieldRenderersProvider>,
  );
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

describe("EditPanelHost redraws (R9)", () => {
  it("draws nothing again, its link field included, while typing changes another element", () => {
    const session = sessionWith(siteWithHero());
    session.select("hero");
    let commits = 0;
    render(
      <FieldRenderersProvider renderers={{ link: linkFieldRenderer({ session }) }}>
        <Profiler id="panel" onRender={() => (commits += 1)}>
          <EditPanelHost session={session} flush={vi.fn()} />
        </Profiler>
      </FieldRenderersProvider>,
    );
    expect(screen.getByRole("textbox", { name: "Title" })).toBeTruthy();
    const drawn = commits;
    // Typing on the canvas, in the Heading: a new document, the same Hero.
    for (const text of ["W", "We", "Wel"]) {
      act(() =>
        session.edit("text", "Edited Heading text", (draft) => {
          const section = draft.pages[draft.homePageId]?.doc.content[0];
          const heading = (section?.props.content as PageDoc["content"] | undefined)?.[0];
          if (heading !== undefined) heading.props.text = text;
        }),
      );
    }
    expect(commits).toBe(drawn);

    // A change to the Hero itself is drawn.
    act(() =>
      session.edit("text", "Edited Hero title", (draft) => {
        const hero = draft.pages[draft.homePageId]?.doc.content[1];
        if (hero !== undefined) hero.props.title = "Fresh bread";
      }),
    );
    expect(commits).toBeGreaterThan(drawn);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveProperty("value", "Fresh bread");
  });
});

describe("EditPanelHost redraws a Section (R9, #296 review)", () => {
  it("draws nothing again while typing in an element inside the selected Section", () => {
    const session = sessionWith(siteWithHero());
    session.select("section-1");
    let commits = 0;
    render(
      <Profiler id="panel" onRender={() => (commits += 1)}>
        <EditPanelHost session={session} flush={vi.fn()} />
      </Profiler>,
    );
    const drawn = commits;
    act(() =>
      session.edit("text", "Edited Heading text", (draft) => {
        const section = draft.pages[draft.homePageId]?.doc.content[0];
        const heading = (section?.props.content as PageDoc["content"] | undefined)?.[0];
        if (heading !== undefined) heading.props.text = "Welcome in";
      }),
    );
    expect(commits).toBe(drawn);
  });
});

describe("EditPanelHost changes to an element that has gone (#296 review)", () => {
  it("does nothing with a change still on its way once the element is deleted", () => {
    const { session, labels } = setup("hero");
    const title = screen.getByRole("textbox", { name: "Title" });
    act(() => {
      // Deleted, and the panel not drawn again yet: its handlers are the Hero's.
      session.edit("remove", "Deleted Hero", (draft) => {
        const content = draft.pages[draft.homePageId]?.doc.content;
        content?.splice(1, 1);
      });
      fireEvent.change(title, { target: { value: "Fresh bread" } });
    });
    expect(labels()).toEqual(["Deleted Hero"]);
  });
});

describe("EditPanelHost in Content mode (M3)", () => {
  it("keeps texts, links and list items, and leaves styles out", async () => {
    const session = sessionWith(siteWithHero());
    session.select("hero");
    const view = render(<EditPanelHost session={session} flush={vi.fn()} contentOnly />);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Content"]);
    expect(screen.getByRole("textbox", { name: "Title" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Button text" })).toBeTruthy();
    expect(screen.queryByText("Alignment")).toBeNull();
    // A list's items stay editable.
    act(() => session.select("faq"));
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
    act(() => session.selectElements(["heading-1", "text-1", "hero-1"]));

    expect(screen.getByRole("status").textContent).toBe("3 elements selected");
  });

  it("shows the selected element's fields", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Heading" })).toBeDefined();
    expect((screen.getByLabelText("Text") as HTMLInputElement).value).toBe(
      "Welcome to our business",
    );
  });

  it("leaves Style this ‹component›…'s deeper groups to the dialog (3.13b)", async () => {
    setup();

    await userEvent.setup({ delay: null }).click(screen.getByRole("tab", { name: "Style" }));

    expect(screen.getByRole("button", { name: "Appearance" })).toBeDefined();
    for (const label of ["Gradient", "Top border", "Top left corner", "Inner shadow", "Padding"]) {
      expect(screen.queryByLabelText(label), label).toBeNull();
    }
    expect(screen.queryByRole("button", { name: "When hovered" })).toBeNull();
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

  it("resets a changed field to its default as one step, and then offers no reset (UX-13)", async () => {
    const { session, labels, heading, user } = setup();
    await user.click(screen.getByRole("tab", { name: "Style" }));
    const size = screen.getByLabelText("Size");
    await user.selectOptions(size, "small");

    fireEvent.contextMenu(screen.getByText("Size", { selector: "label" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reset to Default" }));

    expect(labels()).toEqual(["Changed Heading size", "Reset Heading size"]);
    // The Heading's own default, not the starter site's value.
    expect(heading()?.size).toBe(siteLibrary.components.Heading?.defaults.size);
    expect(session.history.entries()[1]?.selectionAfter.nodeId).toBe("heading-1");
    fireEvent.contextMenu(screen.getByText("Size", { selector: "label" }));
    expect(
      (await screen.findByRole("menuitem", { name: "Reset to Default" })).getAttribute(
        "aria-disabled",
      ),
    ).toBe("true");
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

    act(() => session.select("hero"));
    act(() => session.select("heading-1"));
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
      session.select(null);
    });
    fireEvent.blur(input);

    expect(screen.getByText("Select an element to edit it")).toBeDefined();
    expect(labels()).toEqual(["Edited Heading text", "Deleted Heading"]);
    const section = currentPage(session)?.doc.content[0];
    expect(section?.props.content).toEqual([]);
  });

  it("shows the empty state for a selection on another page", () => {
    const { session } = setup();

    // The page shown is taken away under the editor; nothing can show a page that isn't there.
    act(() =>
      session.edit("props", "Removed the page shown", (draft) => {
        delete draft.pages[session.ui.getState().pageId];
      }),
    );

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
    act(() => session.select(copiedNodeId(copyId, "heading-1")));
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
      act(() => session.setViewport("mobile"));

      await user.click(side("Padding Top").getByRole("radio", { name: "S" }));

      expect(section()?.padding).toEqual({
        $responsive: { desktop: { top: "m", bottom: "m" }, mobile: { top: "s", bottom: "m" } },
      });
      // Its dot is the accent colour on Mobile; Desktop shows no dots (UX-19).
      expect(screen.getByRole("button", { name: /^Padding: set for Mobile only/ })).toBeDefined();
      act(() => session.setViewport("desktop"));
      expect(document.querySelectorAll("[data-device-dot]")).toHaveLength(0);
      expect(
        side("Padding Top").getByRole("radio", { name: "M" }).getAttribute("aria-checked"),
      ).toBe("true");

      act(() => session.setViewport("mobile"));
      await user.click(screen.getByRole("button", { name: /^Padding: set for Mobile only/ }));

      expect(section()?.padding).toEqual({ top: "m", bottom: "m" });
      expect(labels()).toEqual([
        "Changed Section padding on Mobile",
        "Reset Section padding on Mobile",
      ]);
      // Back to Desktop's value: the dot is grey again.
      expect(
        screen.getByRole("img", { name: /^Padding: same as Desktop on Mobile/ }),
      ).toBeDefined();
    });

    it("shows a kind's look set per device as the look's, not as the element's own (3.12)", async () => {
      const site = siteWithHero();
      site.theme.looks = {
        Heading: { lookShadow: { $responsive: { desktop: "large", mobile: "none" } } },
      };
      const session = sessionWith(site);
      session.select("heading-1");
      render(<EditPanelHost session={session} flush={vi.fn()} />);
      act(() => session.setViewport("mobile"));
      await userEvent.setup({ delay: null }).click(screen.getByRole("tab", { name: "Style" }));

      // The look's Mobile value, marked as following Desktop: not set for Mobile on this Heading,
      // so there's no per-device Reset to write the look into it.
      expect(screen.getByRole("img", { name: /^Shadow: same as Desktop on Mobile/ })).toBeDefined();
      expect(screen.queryByRole("button", { name: /^Shadow: set for Mobile only/ })).toBeNull();
      const heading = (
        currentPage(session)?.doc.content[0]?.props.content as PageDoc["content"] | undefined
      )?.[0];
      expect(heading?.props.lookShadow).toBeUndefined();
    });

    it("says where each Appearance value comes from, and shows the theme's (3.12, CT-3)", async () => {
      const site = siteWithHero();
      site.theme.looks = { Heading: { lookShadow: "large" } };
      const heading = (
        site.pages[site.homePageId]?.doc.content[0]?.props.content as PageDoc["content"] | undefined
      )?.[0];
      if (heading !== undefined)
        Object.assign(heading.props, { lookCorners: "full", lookShadow: "small" });
      const session = sessionWith(site);
      session.select("heading-1");
      const revealSource = vi.fn();
      render(<EditPanelHost session={session} flush={vi.fn()} revealSource={revealSource} />);
      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole("tab", { name: "Style" }));
      const sourceOf = (field: string) =>
        document.querySelector(`[data-field="${field}"] [data-source]`)?.textContent;

      expect(sourceOf("lookCorners")).toBe("Set here");
      expect(sourceOf("lookShadow")).toBe("Set here");
      // Nothing to add to the control's own *Theme's* (#567).
      expect(sourceOf("lookColor")).toBeUndefined();

      // Reset where the Heading look sets it: back to the look, which it then follows.
      fireEvent.contextMenu(screen.getByText("Shadow", { selector: "label" }));
      await user.click(await screen.findByRole("menuitem", { name: "Reset to Theme's Look" }));
      expect(sourceOf("lookShadow")).toBe("Theme's look for Heading");
      await user.click(screen.getByRole("button", { name: "Theme's look for Heading" }));
      expect(revealSource).toHaveBeenCalledWith("look:Heading");

      // On Mobile, Reset makes the device follow Desktop: not the look's (#567).
      act(() => session.setViewport("mobile"));
      fireEvent.contextMenu(screen.getByText("Shadow", { selector: "label" }));
      expect(await screen.findByRole("menuitem", { name: "Reset to Default" })).toBeDefined();
      expect(screen.queryByRole("menuitem", { name: "Reset to Theme's Look" })).toBeNull();
    });

    it("sets another device's value from its row, and dots the device in effect (SP-5)", async () => {
      const { session, labels, section, user } = setup("section-1");
      await user.click(screen.getByRole("button", { name: "Padding on each device" }));
      const row = (device: string) =>
        within(document.querySelector(`[data-device="${device}"]`) as HTMLElement);
      const inEffect = () =>
        [...document.querySelectorAll("[data-device]")]
          .filter((each) => within(each as HTMLElement).queryByRole("img", { name: /In effect/ }))
          .map((each) => each.getAttribute("data-device"));
      expect(inEffect()).toEqual(["desktop"]);

      // From Desktop, Mobile's own value: one step, named for Mobile.
      await user.click(row("mobile").getAllByRole("radio", { name: "S" })[0] as HTMLElement);
      expect(labels()).toEqual(["Changed Section padding on Mobile"]);
      expect(section()?.padding).toMatchObject({ $responsive: { mobile: { top: "s" } } });

      // Shown on Mobile, Mobile's value is the one in effect; Tablet still takes Desktop's.
      act(() => session.setViewport("mobile"));
      expect(inEffect()).toEqual(["mobile"]);
      expect(row("mobile").getByText("Mobile").className).toContain("text-ring");
      expect(row("tablet").getByText("Tablet").className).not.toContain("text-ring");
    });

    it("resets a changed group to its defaults as one step, named by the group (UX-13)", async () => {
      const { labels, section, user } = setup("section-1");
      await user.click(side("Padding Top").getByRole("radio", { name: "S" }));
      const spacing = screen.getByRole("button", { name: "Spacing" });
      expect(spacing.hasAttribute("data-changed")).toBe(true);

      fireEvent.contextMenu(spacing);
      await user.click(await screen.findByRole("menuitem", { name: "Reset Group to Defaults" }));

      expect(labels()).toEqual(["Changed Section padding", "Reset Spacing on Section"]);
      expect(section()?.padding).toEqual(siteLibrary.components.Section?.defaults.padding);
      expect(screen.getByRole("button", { name: "Spacing" }).hasAttribute("data-changed")).toBe(
        false,
      );
    });

    it("pastes a copied group's values back as one step, named by the group (SP-7)", async () => {
      const { labels, section, user } = setup("section-1");
      await user.click(side("Padding Top").getByRole("radio", { name: "S" }));
      const changed = section()?.padding;
      await user.click(screen.getByRole("button", { name: "Copy Spacing" }));
      await user.click(screen.getByRole("button", { name: "Reset Spacing" }));

      await user.click(screen.getByRole("button", { name: "Paste Spacing" }));

      expect(section()?.padding).toEqual(changed);
      expect(labels()).toEqual([
        "Changed Section padding",
        "Reset Spacing on Section",
        "Pasted Spacing on Section",
      ]);
    });

    it("on Mobile, resets only the group's Mobile values, and says so (F-ED-4)", async () => {
      const { session, labels, section, user } = setup("section-1");
      act(() => session.setViewport("mobile"));
      await user.click(side("Padding Top").getByRole("radio", { name: "S" }));

      fireEvent.contextMenu(screen.getByRole("button", { name: "Spacing" }));
      await user.click(await screen.findByRole("menuitem", { name: "Reset Group to Defaults" }));

      expect(labels()).toEqual([
        "Changed Section padding on Mobile",
        "Reset Section spacing on Mobile",
      ]);
      expect(section()?.padding).toEqual({ top: "m", bottom: "m" });
    });

    it("shows the groups closed for the element's type, and reports closing another (UX-13)", async () => {
      const session = sessionWith(siteWithHero());
      session.select("section-1");
      const onClosedGroupsChange = vi.fn();
      render(
        <EditPanelHost
          session={session}
          flush={vi.fn()}
          closedGroups={{ Section: ["style:spacing"], Heading: ["style:appearance"] }}
          onClosedGroupsChange={onClosedGroupsChange}
        />,
      );
      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole("tab", { name: "Style" }));

      expect(screen.getByRole("button", { name: "Spacing" }).getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(screen.getByRole("button", { name: "Appearance" }).getAttribute("aria-expanded")).toBe(
        "true",
      );
      await user.click(screen.getByRole("button", { name: "Appearance" }));

      expect(onClosedGroupsChange).toHaveBeenCalledWith("Section", [
        "style:spacing",
        "style:appearance",
      ]);
      // Nothing in the document: no undo step.
      expect(session.history.entries()).toEqual([]);
    });

    it("shows a field in the option group its definition names (UX-13)", async () => {
      const library: ComponentLibrary = {
        components: {
          ...siteLibrary.components,
          Heading: {
            ...(siteLibrary.components.Heading as NonNullable<
              (typeof siteLibrary.components)["Heading"]
            >),
            fields: {
              ...siteLibrary.components.Heading?.fields,
              size: {
                ...(siteLibrary.components.Heading?.fields.size as FieldDef),
                optionGroup: { id: "typography", label: "Typography" },
              } as FieldDef,
            },
          },
        },
      };
      const session = createEditorSession(library, siteWithHero());
      session.select("heading-1");
      render(<EditPanelHost session={session} flush={vi.fn()} />);
      await userEvent.setup({ delay: null }).click(screen.getByRole("tab", { name: "Style" }));

      expect(screen.getByRole("button", { name: "Typography" })).toBeDefined();
    });

    it("sets Desktop's value as the plain value, keeping other devices' own", async () => {
      const { session, labels, section, user } = setup("section-1");
      act(() => session.setViewport("tablet"));
      await user.click(side("Padding Bottom").getByRole("radio", { name: "L" }));
      act(() => session.setViewport("desktop"));

      await user.click(side("Padding Left").getByRole("radio", { name: "None" }));

      expect(section()?.padding).toEqual({
        $responsive: {
          desktop: { top: "m", bottom: "m", left: "none" },
          tablet: { top: "m", bottom: "l" },
        },
      });
      expect(labels()).toEqual(["Changed Section padding on Tablet", "Changed Section padding"]);
    });

    it("sets every side at once of a padding set on some sides only (1.32)", async () => {
      const { session, labels, section, user } = setup("section-1");
      act(() =>
        session.edit("props", "Top and bottom padding", (draft) => {
          const old = draft.pages[draft.homePageId]?.doc.content[0];
          if (old !== undefined) {
            old.props.padding = {
              $responsive: {
                desktop: { top: "l", bottom: "l" },
                mobile: { top: "s", bottom: "s" },
              },
            };
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
      act(() => session.setViewport("mobile"));
      expect(screen.queryByRole("radiogroup", { name: "Padding Top" })).toBeNull();
      act(() => session.setViewport("desktop"));
      expect(side("Padding Top")).toBeDefined();

      act(() => session.select("section-2"));
      expect(screen.queryByRole("radiogroup", { name: "Padding Top" })).toBeNull();
      await user.click(screen.getByRole("switch", { name: "Padding Same on every side" }));
      act(() => session.select("section-1"));
      expect(side("Padding Top")).toBeDefined();
      act(() => session.select("section-2"));
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

    it("makes one step of scrubbing a slider's step name (UX-20)", () => {
      const { session, labels, section } = setup("section-1");
      const slider = screen.getByLabelText("Space between elements");
      const output = slider.parentElement?.querySelector("output");
      if (output == null) throw new Error("no step name");

      fireEvent.pointerDown(output, { button: 0, pointerId: 1 });
      output.dispatchEvent(new PointerEvent("pointermove", { movementX: 12 }));
      output.dispatchEvent(new PointerEvent("pointermove", { movementX: -24 }));
      output.dispatchEvent(new PointerEvent("pointerup"));

      expect(section()?.gap).toBe("small");
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
      act(() => session.setViewport("mobile"));
      const slider = () => screen.getByLabelText("Space between elements");

      fireEvent.pointerDown(slider());
      fireEvent.change(slider(), { target: { value: "0" } });
      act(() => session.setViewport("desktop"));
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
      session.select("ratings");
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
      const session = sessionWith(siteWithHero());
      session.select("heading-1");
      // The CSS classes field, with no catalogue of classes to suggest and every class making a style.
      const canvas = {
        classCatalogue: () => Promise.resolve({ status: "failed" }),
        classCss: (_theme, classes) =>
          Promise.resolve({ status: "css", css: classes.map(() => ".x{}") }),
        compileCss: () => Promise.resolve({ status: "failed" }),
        itemHtml: () => Promise.resolve({ status: "failed" }),
      } satisfies CanvasApi;
      render(
        <FieldRenderersProvider
          renderers={{ classes: classesFieldRenderer({ session, canvas: () => canvas }) }}
        >
          <EditPanelHost session={session} flush={vi.fn()} advanced />
        </FieldRenderersProvider>,
      );
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
      act(() => session.select("footer"));
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
        session.select("footer");
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
      const { session, labels, user } = setup("hero", (session) => ({
        image: imageFieldRenderer({
          session,
          media: { choose: async () => ({ status: "canceled" }) },
          imageUrl: (item) => `test://${item.name}`,
        }),
      }));
      act(() => addMedia(session, [shop]));
      const hero = () => currentPage(session)?.doc.content[1]?.props;

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
    });

    it("places a section's first background image with the overlay the theme needs, as one step (ST-9)", async () => {
      const { session, labels, user } = setup("faq", (session) => ({
        image: imageFieldRenderer({
          session,
          media: { choose: async () => ({ status: "canceled" }) },
          imageUrl: (item) => `test://${item.name}`,
        }),
      }));
      act(() => {
        addMedia(session, [shop]);
        session.edit("props", "Chose the dark theme", (draft) => {
          const dark = themePreset("dark");
          if (dark !== undefined) draft.theme = dark;
        });
      });
      const faq = () => currentPage(session)?.doc.content[2]?.props;
      const steps = labels().length;

      await user.click(screen.getByRole("tab", { name: "Content" }));
      await user.click(screen.getByRole("button", { name: "Background image Choose an image…" }));
      await user.dblClick(screen.getByRole("option", { name: "shop.jpg" }));

      // Dark's text needs a very strong overlay over any image.
      expect(faq()?.backgroundImage).toEqual({ mediaId: "shop" });
      expect(faq()?.overlay).toBe("80");
      expect(labels().slice(steps)).toEqual(["Changed FAQ background image"]);
      // Another theme later leaves it: the overlay warning covers what it changes.
      act(() =>
        session.edit("props", "Chose the light theme", (draft) => {
          const light = themePreset("light");
          if (light !== undefined) draft.theme = light;
        }),
      );
      expect(faq()?.overlay).toBe("80");
      act(() => {
        session.history.undo();
        session.history.undo();
      });
      expect(faq()?.backgroundImage).toBeUndefined();
      expect(faq()?.overlay).toBeUndefined();
    });

    it("chooses that overlay for the text colour the section's kind's look gives it (3.12)", async () => {
      const look = { lookColor: "neutral-content" };
      const { session, user } = setup("faq", (session) => ({
        image: imageFieldRenderer({
          session,
          media: { choose: async () => ({ status: "canceled" }) },
          imageUrl: (item) => `test://${item.name}`,
        }),
      }));
      act(() => {
        addMedia(session, [shop]);
        session.edit("props", "Gave FAQs a look", (draft) => {
          draft.theme.looks = { Faq: look };
        });
      });
      const faq = () => currentPage(session)?.doc.content[2]?.props;
      const def = siteLibrary.components.Faq;
      if (def === undefined) throw new Error("no FAQ");
      const { theme } = session.history.document.getState();
      const overlayFor = (values: Readonly<Record<string, unknown>>) =>
        placedOverlay(BACKGROUND_FIELDS.backgroundImage, values, { mediaId: "shop" }, theme, def);
      // The look's light text needs another overlay than the FAQ's own text would.
      expect(overlayFor({ ...def.defaults, ...look })).not.toBe(overlayFor(def.defaults));

      await user.click(screen.getByRole("tab", { name: "Content" }));
      await user.click(screen.getByRole("button", { name: "Background image Choose an image…" }));
      await user.dblClick(screen.getByRole("option", { name: "shop.jpg" }));

      expect(faq()?.overlay).toBe(overlayFor({ ...def.defaults, ...look }));
    });
  });
});

describe("EditPanelHost with a layout that leaves fields out (#311)", () => {
  it("hides the Hero's Image while it is text only, and shows it again with its value", async () => {
    const { session, user } = setup("hero", (session) => ({
      image: imageFieldRenderer({
        session,
        media: { choose: async () => ({ status: "canceled" }) },
        imageUrl: (item) => `test://${item.name}`,
      }),
    }));
    const image = { mediaId: "shop", alt: "A loaf" };
    act(() =>
      session.edit("props", "Changed Hero image", (draft) => {
        const page = draft.pages[draft.homePageId]?.doc.content;
        const hero = page?.find((node) => node.props.id === "hero");
        if (hero !== undefined) hero.props.image = image;
      }),
    );
    const imageField = () => screen.queryAllByRole("button", { name: /^Image/ })[0] ?? null;
    const layout = async (variant: string) => {
      await user.click(screen.getByRole("tab", { name: "Style" }));
      await user.selectOptions(screen.getByLabelText("Layout"), variant);
      await user.click(screen.getByRole("tab", { name: "Content" }));
    };

    await user.click(screen.getByRole("tab", { name: "Content" }));
    expect(imageField()).not.toBeNull();
    await layout("minimal");
    expect(imageField()).toBeNull();
    await layout("split");
    expect(imageField()).not.toBeNull();
    const hero = currentPage(session)?.doc.content.find((node) => node.props.id === "hero");
    expect(hero?.props.image).toEqual(image);
  });
});
