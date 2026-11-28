// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_THEME, type SharedSectionId, type Theme, themeIdSchema } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnTheme, ThemesApi } from "../../../shared/ipc/themes.js";
import { starterSite } from "../../../shared/starter-site.js";
import type { Announcement } from "../../editor/editor-session.js";
import { createOwnThemes } from "../../editor/own-themes.js";
import { sessionWith } from "../../testing/fixtures.js";
import { OwnThemeDialogs } from "../OwnThemeDialogs.js";
import { ThemePanel } from "../ThemePanel.js";
import { createStudio, type StudioSection } from "./studio-state.js";
import { ThemeStudio } from "./ThemeStudio.js";

afterEach(cleanup);

/** Theme Studio open on `section`, on the starter site, with a confirmation that says yes. */
function setUp(section: StudioSection = "themes") {
  const session = sessionWith();
  const studio = createStudio();
  studio.setState({ open: true, section });
  const siteWide = { confirmSiteWide: vi.fn(() => Promise.resolve(true)) };
  render(<ThemeStudio session={session} studio={studio} siteWide={siteWide} />);
  return {
    session,
    studio,
    siteWide,
    dialog: () => within(screen.getByRole("dialog", { name: "Theme Studio" })),
    labels: () => session.history.entries().map((entry) => entry.label),
    theme: () => session.history.document.getState().theme,
    user: userEvent.setup({ delay: null }),
  };
}

describe("Theme Studio (2.3b, F-DS-7)", () => {
  it("opens from the Theme tab's button, as a large dialog in the window, and closes again", async () => {
    const session = sessionWith();
    const studio = createStudio();
    render(
      <>
        <ThemePanel session={session} studio={studio} />
        <ThemeStudio session={session} studio={studio} />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open Theme Studio" }));
    const dialog = screen.getByRole("dialog", { name: "Theme Studio" });
    expect(
      within(dialog)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Themes", "Colours", "Text", "Styles", "Components"]);
    await userEvent.keyboard("{Escape}");
    expect(studio.getState().open).toBe(false);
  });

  it("opens with the focus on its section's tab, keeping the section it opens on (CT-11)", async () => {
    const { studio } = setUp("components");

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Components" })),
    );
    expect(studio.getState().section).toBe("components");
  });

  it("keeps a sample page in the theme in view over Colours, Text and Styles, not Themes (CT-11)", async () => {
    const session = sessionWith();
    const studio = createStudio();
    studio.setState({ open: true, section: "themes" });
    render(
      <ThemeStudio
        session={session}
        studio={studio}
        siteWide={{ confirmSiteWide: () => Promise.resolve(true) }}
        itemPreviews={(node, device, theme) => (
          <span data-testid={`${node.type}-${device}`}>
            {JSON.stringify(theme?.colors.primary)}
          </span>
        )}
      />,
    );
    const user = userEvent.setup({ delay: null });
    const page = () => screen.queryByRole("region", { name: "A sample page in your theme" });
    expect(page()).toBeNull();

    for (const section of ["Colours", "Text", "Styles"]) {
      await user.click(screen.getByRole("tab", { name: section }));
      const shown = within(page() as HTMLElement);
      expect(shown.getByTestId("Hero-desktop")).toBeDefined();
      expect(shown.getByTestId("Features-mobile")).toBeDefined();
      expect(shown.getByTestId("CallToAction-desktop").textContent).toBe(
        JSON.stringify(session.history.document.getState().theme.colors.primary),
      );
    }
    // Drawn in the theme as it changes.
    await user.click(screen.getByRole("tab", { name: "Colours" }));
    const hex = screen.getByRole("textbox", { name: "Brand Page hex code" });
    await user.clear(hex);
    await user.type(hex, "#0369a1{Enter}");
    await vi.waitFor(() =>
      expect(within(page() as HTMLElement).getByTestId("Hero-desktop").textContent).toBe(
        JSON.stringify(session.history.document.getState().theme.colors.primary),
      ),
    );
    expect(session.history.document.getState().theme.colors.primary).not.toEqual(
      starterSite().theme.colors.primary,
    );
  });

  it("shows each theme as a card, its own marked, and switches to one once asked (D7)", async () => {
    const { dialog, siteWide, labels, theme, user } = setUp();

    const light = dialog().getByRole("button", { name: /Light/ });
    expect(light.getAttribute("aria-pressed")).toBe("true");
    await user.click(dialog().getByRole("button", { name: /Bistro/ }));

    expect(siteWide.confirmSiteWide).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(theme().preset).toBe("bistro"));
    expect(labels()).toEqual(["Changed theme to 'Bistro'"]);
  });

  it("sets a reversed section's colour on its own, with shades and warnings per palette", async () => {
    const { dialog, labels, theme, user } = setUp("colors");
    const page = theme().colors.info;

    expect(dialog().getAllByRole("list", { name: "Shades of Brand" })).toHaveLength(2);
    const hex = dialog().getByRole("textbox", { name: "Information Reversed sections hex code" });
    await user.clear(hex);
    await user.type(hex, "#0369a1{Enter}");

    await vi.waitFor(() =>
      expect(labels()).toEqual(["Changed Information colour in reversed sections"]),
    );
    expect(theme().colors.info).toEqual(page);
  });

  it("sets a text style's size, weight and line height, and the links' underline", async () => {
    const { dialog, labels, theme, user } = setUp("text");

    await user.selectOptions(dialog().getByRole("combobox", { name: "Heading 1 Weight" }), "800");
    await user.selectOptions(
      dialog().getByRole("combobox", { name: "Body text Line height" }),
      "normal",
    );
    await user.selectOptions(dialog().getByRole("combobox", { name: "Underline links" }), "hover");

    expect(theme().typeScale.h1.weight).toBe(800);
    expect(theme().typeScale.body.leading).toBe("normal");
    expect(theme().links.underline).toBe("hover");
    expect(labels()).toEqual([
      "Changed text style for Heading 1",
      "Changed text style for Body text",
      "Changed link style",
    ]);
  });

  it("sets the other styles, the corner scale drawn as samples", async () => {
    const { dialog, labels, theme, user } = setUp("styles");

    const corners = dialog().getByRole("radiogroup", { name: "Corners of boxes and cards" });
    await user.click(within(corners).getByRole("radio", { name: "Extra large" }));
    await user.click(dialog().getByRole("checkbox", { name: "Grain on surfaces" }));

    expect(theme().radius.box).toBe("xl");
    expect(theme().effects.noise).toBe(true);
    expect(labels()).toEqual(["Changed corner style", "Changed effects"]);
    // The buttons' tokens and the card style are in Components, with their looks (3.12).
    expect(dialog().queryByRole("combobox", { name: "Card style" })).toBeNull();
  });
});

describe("Theme Studio's My themes (2.23, PH2-17)", () => {
  /** Theme Studio on its themes, with My themes holding a "Night" theme, and its dialogs. */
  async function withMyThemes() {
    const session = sessionWith();
    const studio = createStudio();
    studio.setState({ open: true, section: "themes" });
    const night: OwnTheme = {
      ...structuredClone(DEFAULT_THEME),
      scheme: "dark",
      own: { id: themeIdSchema.parse("theme0000000000n"), name: "Night" },
    };
    const api = {
      list: vi.fn(() => Promise.resolve([night])),
      keep: vi.fn(() => Promise.resolve("kept" as const)),
      remove: vi.fn(() => Promise.resolve(null)),
    } satisfies ThemesApi;
    const ownThemes = createOwnThemes(() => api);
    function Window() {
      return (
        <>
          <ThemeStudio session={session} studio={studio} ownThemes={ownThemes} />
          <OwnThemeDialogs ownThemes={ownThemes} site={session.history.document.getState().theme} />
        </>
      );
    }
    render(<Window />);
    const dialog = () => within(screen.getByRole("dialog", { name: "Theme Studio" }));
    await dialog().findByRole("button", { name: /^Night/ });
    return {
      session,
      api,
      dialog,
      labels: () => session.history.entries().map((entry) => entry.label),
      theme: () => session.history.document.getState().theme,
      user: userEvent.setup({ delay: null }),
    };
  }

  it("lists the person's own themes first, then the built-in ones, and uses one", async () => {
    const { dialog, labels, theme, user } = await withMyThemes();

    const mine = dialog().getByRole("list", { name: "My themes" });
    expect(within(mine).getAllByRole("button", { name: /^Night/ })).toHaveLength(1);
    expect(dialog().getByRole("list", { name: "Built-in themes" })).toBeDefined();
    await user.click(within(mine).getByRole("button", { name: /^Night/ }));

    await vi.waitFor(() => expect(theme().own?.name).toBe("Night"));
    expect(labels()).toEqual(["Changed theme to 'Night'"]);
  });

  it("creates a new theme from a built-in one, by name", async () => {
    const { dialog, labels, theme, user } = await withMyThemes();

    await user.click(dialog().getByRole("button", { name: "New Theme…" }));
    const form = within(await screen.findByRole("dialog", { name: "New Theme" }));
    await user.selectOptions(form.getByRole("combobox", { name: "Start from" }), "bistro");
    const name = form.getByRole("textbox", { name: "Theme name" });
    await user.clear(name);
    await user.type(name, "Shop");
    await user.click(form.getByRole("button", { name: "Create Theme" }));

    await vi.waitFor(() => expect(theme().own?.name).toBe("Shop"));
    expect(theme().preset).toBe("bistro");
    expect(labels()).toEqual(["Created theme 'Shop'"]);
  });

  it("renames and deletes one of the person's own; the site keeps its copy", async () => {
    const { dialog, api, labels, theme, user } = await withMyThemes();
    await user.click(dialog().getByRole("button", { name: /^Night/ }));
    await vi.waitFor(() => expect(theme().own?.name).toBe("Night"));

    await user.click(dialog().getByRole("button", { name: "Rename Night" }));
    const rename = within(await screen.findByRole("dialog", { name: "Rename Theme" }));
    const name = rename.getByRole("textbox", { name: "Theme name" });
    await user.clear(name);
    await user.type(name, "Late night");
    await user.click(rename.getByRole("button", { name: "Rename" }));
    await vi.waitFor(() => expect(theme().own?.name).toBe("Late night"));
    expect(labels()).toEqual(["Changed theme to 'Night'", "Renamed theme to 'Late night'"]);

    await user.click(dialog().getByRole("button", { name: "Delete Late night" }));
    const remove = within(await screen.findByRole("alertdialog"));
    expect(remove.getByText(/This site keeps its copy/)).toBeDefined();
    await user.click(remove.getByRole("button", { name: "Delete Theme" }));

    expect(api.remove).toHaveBeenCalledWith("theme0000000000n");
    expect(theme().own?.name).toBe("Late night");
    expect(labels()).toHaveLength(2);
  });
});

describe("Theme Studio's Components (3.12, CT-1; M1)", () => {
  /**
   * Theme Studio on Components' Button, on a site with two Buttons, with a preview strip that says
   * which look it draws, and the notices it shows.
   */
  function onButton() {
    const site = starterSite();
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    home.doc.content.push({
      type: "Section",
      props: {
        id: "buttons",
        content: [
          { type: "Button", props: { id: "b1", label: "Book" } },
          { type: "Button", props: { id: "b2", label: "Call" } },
        ],
      },
    });
    const session = sessionWith(site);
    const studio = createStudio();
    studio.setState({ open: true, section: "components", kind: "Button" });
    const siteWide = { confirmSiteWide: vi.fn(() => Promise.resolve(true)) };
    const notices: Announcement[] = [];
    session.onEntryAdded((_entry, _kind, announced) => {
      if (announced !== false) notices.push(announced);
    });
    const lookOf = (type: string, theme?: Theme) =>
      JSON.stringify((theme ?? session.history.document.getState().theme).looks?.[type] ?? {});
    render(
      <ThemeStudio
        session={session}
        studio={studio}
        siteWide={siteWide}
        itemPreviews={(node, device, theme) => (
          <span data-testid={`preview-${device}`}>{lookOf(node.type, theme)}</span>
        )}
      />,
    );
    return {
      session,
      studio,
      siteWide,
      notices,
      dialog: () => within(screen.getByRole("dialog", { name: "Theme Studio" })),
      button: () => within(screen.getByRole("region", { name: "Button" })),
      kinds: () => screen.getByRole("combobox", { name: "Sections and elements" }),
      labels: () => session.history.entries().map((entry) => entry.label),
      theme: () => session.history.document.getState().theme,
      user: userEvent.setup({ delay: null }),
    };
  }

  it("applies each change at once as one step, unasked, saying how many it restyled with Undo", async () => {
    const { dialog, button, kinds, labels, theme, siteWide, notices, user } = onButton();
    // In the bar at the top, by category (CT-11).
    expect(kinds().querySelector('optgroup[label="Sections"] option[value="Card"]')).not.toBeNull();
    expect((kinds() as HTMLSelectElement).value).toBe("Button");
    // The theme's button tokens beside the Button look, as in the Theme tab.
    expect(button().getByText("Every button")).toBeDefined();
    // No draft's bar, and nothing to compare: what shows is the theme.
    expect(dialog().queryByRole("button", { name: "Apply Changes" })).toBeNull();
    expect(dialog().queryByRole("radio", { name: "Theme now" })).toBeNull();
    // The reset is in the bar, always there (#1517): unavailable while nothing is set, saying why.
    const reset = () => dialog().getByRole("button", { name: "Reset Button to Default" });
    expect(reset().getAttribute("aria-disabled")).toBe("true");
    expect(reset().getAttribute("aria-describedby")).not.toBeNull();
    expect(kinds().querySelector('option[value="Button"]')?.textContent).toBe("Button");

    await user.selectOptions(button().getByRole("combobox", { name: "Corners" }), "full");
    await waitFor(() => expect(labels()).toEqual(["Changed the theme's look for Button"]));
    await user.selectOptions(button().getByRole("combobox", { name: "Shadow" }), "large");
    await waitFor(() =>
      expect(labels()).toEqual([
        "Changed the theme's look for Button",
        "Changed the theme's look for Button",
      ]),
    );
    expect(theme().looks).toEqual({ Button: { lookCorners: "full", lookShadow: "large" } });
    expect(screen.getByTestId("preview-desktop").textContent).toBe(
      JSON.stringify({ lookCorners: "full", lookShadow: "large" }),
    );
    // Never asked (M1, amending D7): said after, one notice for the kind, replaced as it goes.
    expect(siteWide.confirmSiteWide).not.toHaveBeenCalled();
    const said = { message: "Changed every Button on your site (2)", id: "theme-look:Button" };
    expect(notices).toEqual([said, said]);

    // What's changed is marked (#1517): the kind in the list, in words, and each field set in
    // the look, with the Edit panel's words for where its value comes from.
    expect(kinds().querySelector('option[value="Button"]')?.textContent).toBe("Button (changed)");
    const corners = button().getByRole("combobox", { name: "Corners" });
    expect(corners.closest("[data-field]")?.querySelector("[data-changed-dot]")).not.toBeNull();
    expect(corners.closest("[data-field]")?.textContent).toContain("Set here");
    expect(reset().getAttribute("aria-disabled")).toBe("false");
    const tokens = theme().buttons;

    // Reset is a step of its own at once: back to the theme's defaults, the look alone.
    await user.click(reset());
    await waitFor(() => expect(theme().looks).toBeUndefined());
    expect(labels().at(-1)).toBe("Reset the theme's look for Button");
    expect(theme().buttons).toEqual(tokens);
    expect(kinds().querySelector('option[value="Button"]')?.textContent).toBe("Button");
    expect(reset().getAttribute("aria-disabled")).toBe("true");
  });

  it("previews the run of changes in the field in use, and writes it as the field is left", async () => {
    const { studio, labels, theme } = onButton();
    // A slider held, or keys pressed within a pause: the run is drawn, not written yet.
    act(() =>
      studio.setState({
        draft: { type: "Button", item: "Button", change: { lookShadow: "large" } },
      }),
    );
    expect(screen.getByTestId("preview-desktop").textContent).toBe(
      JSON.stringify({ lookShadow: "large" }),
    );
    expect(theme().looks).toBeUndefined();
    expect(labels()).toEqual([]);
  });

  it("writes a run still open before another kind shows, before closing, and before an undo", async () => {
    const { studio, kinds, labels, theme, user } = onButton();
    const run = { type: "Button", item: "Button", change: { lookCorners: "full" } };

    act(() => studio.setState({ draft: run }));
    await user.selectOptions(kinds(), "Card");
    await waitFor(() => expect(studio.getState().kind).toBe("Card"));
    expect(theme().looks).toEqual({ Button: { lookCorners: "full" } });

    // Ctrl/Cmd+Z with a run open writes it, then undoes it: the person sees their change reversed.
    act(() =>
      studio.setState({
        kind: "Button",
        draft: { ...run, change: { lookShadow: "large" } },
      }),
    );
    await user.keyboard("{Control>}z{/Control}");
    // Written as a step, then undone: back as it was, with the run's step to redo.
    await waitFor(() => expect(theme().looks).toEqual({ Button: { lookCorners: "full" } }));
    expect(labels()).toEqual([
      "Changed the theme's look for Button",
      "Changed the theme's look for Button",
    ]);

    act(() => studio.setState({ draft: { ...run, change: { lookBorder: "thick" } } }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(studio.getState().open).toBe(false));
    expect(theme().looks).toEqual({ Button: { lookCorners: "full", lookBorder: "thick" } });
  });

  it("says nothing after a change to a kind the site has none of yet", async () => {
    const { kinds, notices, labels, user } = onButton();
    await user.selectOptions(kinds(), "Gallery");
    const gallery = within(screen.getByRole("region", { name: "Gallery" }));
    await user.selectOptions(gallery.getByRole("combobox", { name: "Shadow" }), "large");
    await waitFor(() => expect(labels()).toEqual(["Changed the theme's look for Gallery"]));
    expect(notices).toEqual([]);
  });

  it("changes Desktop's value of a look set per device, keeping Tablet's and Mobile's", async () => {
    const site = starterSite();
    site.theme.looks = {
      Button: { lookShadow: { $responsive: { desktop: "large", mobile: "none" } } },
    };
    const session = sessionWith(site);
    const studio = createStudio();
    studio.setState({ open: true, section: "components", kind: "Button" });
    render(<ThemeStudio session={session} studio={studio} />);
    const button = within(screen.getByRole("region", { name: "Button" }));
    const user = userEvent.setup({ delay: null });

    expect(button.getByText(/^Set per device/)).toBeDefined();
    await user.selectOptions(button.getByRole("combobox", { name: "Shadow" }), "medium");

    await waitFor(() =>
      expect(session.history.document.getState().theme.looks).toEqual({
        Button: { lookShadow: { $responsive: { desktop: "medium", mobile: "none" } } },
      }),
    );
  });

  it("gives a gradient's direction its colours, Brand to Accent, in the same step (CT-10)", async () => {
    const { button, labels, theme, user } = onButton();
    // No colour rows while the gradient has no direction.
    expect(button().queryByText("Gradient starts with")).toBeNull();

    await user.selectOptions(button().getByRole("combobox", { name: "Gradient" }), "toRight");
    expect(button().getByText("Gradient starts with")).toBeDefined();

    await waitFor(() => expect(labels()).toEqual(["Changed the theme's look for Button"]));
    expect(theme().looks).toEqual({
      Button: {
        lookGradientDirection: "toRight",
        lookGradientFrom: "primary",
        lookGradientTo: "secondary",
      },
    });
  });

  it("offers your colours in a look's colour fields, but no one-off (TC-1b, ADR 0009)", async () => {
    const { session, button, theme, user } = onButton();
    act(() =>
      session.edit("root", "Added colour 'Harbour blue'", (draft) => {
        draft.theme.ownColors = [
          { id: "csky", name: "Harbour blue", color: { l: 0.62, c: 0.14, h: 240 } },
        ];
      }),
    );
    // Every colour field of the look lists it under Your colours; none offers another colour.
    const yours = button().getAllByRole("radio", { name: "Harbour blue" });
    expect(yours.length).toBeGreaterThan(0);
    expect(button().getAllByText("Your colours").length).toBe(yours.length);
    expect(button().queryByRole("radio", { name: "Another colour…" })).toBeNull();

    const [first] = yours;
    if (first === undefined) throw new Error("no colour field");
    await user.click(first);
    await waitFor(() => expect(JSON.stringify(theme().looks?.Button)).toContain('"own-csky"'));
  });

  it("shows the card style as the Card look, changed at once", async () => {
    const { dialog, labels, theme, user } = setUp("components");

    await user.selectOptions(
      dialog().getByRole("combobox", { name: "Sections and elements" }),
      "Card",
    );
    const card = within(dialog().getByRole("region", { name: "Card" }));
    expect(card.getByText("The cards in Features, Stats, Team and Testimonials.")).toBeDefined();
    await user.selectOptions(card.getByRole("combobox", { name: "Card style" }), "raised");

    expect(theme().cards.style).toBe("raised");
    expect(labels()).toEqual(["Changed card style"]);
  });
});

describe("Theme Studio's colours outside your theme (5.32, TC-4)", () => {
  /** Studio on Colours, with a Heading on the home page in one-off `#1f6feb`. */
  function withOneOff() {
    const site = starterSite();
    site.pages[site.homePageId]?.doc.content.push({
      type: "Heading",
      props: { id: "blue-heading", text: "Blue", color: "[#1f6feb]" },
    });
    const session = sessionWith(site);
    const studio = createStudio();
    studio.setState({ open: true, section: "colors" });
    render(<ThemeStudio session={session} studio={studio} />);
    return { session, studio, user: userEvent.setup({ delay: null }) };
  }

  it("lists the site's one-offs and goes to a use: Studio closes, the element selected", async () => {
    const { session, studio, user } = withOneOff();
    const listed = screen.getByRole("listitem", { name: "#1f6feb" });
    const use = within(listed).getByRole("button", { name: /^Show Heading on / });

    await user.click(use);

    expect(studio.getState().open).toBe(false);
    expect(session.ui.getState().nodeId).toBe("blue-heading");
  });

  it("lists a use it can't go to as text, and stays open: a shared section placed on no page", () => {
    const site = starterSite();
    const hours = "hours" as SharedSectionId;
    site.sharedSections[hours] = {
      id: hours,
      name: "Hours",
      section: {
        type: "Section",
        props: {
          id: "s",
          content: [{ type: "Heading", props: { id: "h", text: "Hours", color: "[#c0392b]" } }],
        },
      },
    };
    const studio = createStudio();
    studio.setState({ open: true, section: "colors" });
    render(<ThemeStudio session={sessionWith(site)} studio={studio} />);

    const where = within(screen.getByRole("listitem", { name: "#c0392b" })).getByRole("list", {
      name: "Where #c0392b is used",
    });
    expect(within(where).queryByRole("button")).toBeNull();
    expect(where.textContent).toContain("(not on any page)");
    expect(studio.getState().open).toBe(true);
  });

  it("writes a run still open in Components first, then goes to the use", async () => {
    const { session, studio, user } = withOneOff();
    act(() =>
      studio.setState({
        draft: { type: "Button", item: "Button", change: { lookCorners: "full" } },
      }),
    );
    await user.click(
      within(screen.getByRole("listitem", { name: "#1f6feb" })).getByRole("button", {
        name: /^Show Heading on /,
      }),
    );

    await waitFor(() => expect(studio.getState().open).toBe(false));
    expect(session.history.document.getState().theme.looks).toEqual({
      Button: { lookCorners: "full" },
    });
    expect(session.ui.getState().nodeId).toBe("blue-heading");
  });
});
